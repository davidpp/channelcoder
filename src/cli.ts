#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { type ClaudeOptions, interactive } from './index.js';
import { loadPromptFile } from './loader.js';
import { PromptTemplate } from './template.js';
import type { InterpolationData } from './types.js';

/**
 * CC CLI - Command line interface for CC SDK
 *
 * Usage:
 *   cc <prompt-file> [options]
 *   cc -p "inline prompt" [options]
 *
 * Options:
 *   -p, --prompt         Inline prompt instead of file
 *   -d, --data          Data for interpolation (key=value pairs)
 *   -s, --system        System prompt (inline or file path)
 *   -t, --tools         Allowed tools (comma-separated)
 *   --stream            Stream output
 *   -v, --verbose       Verbose output
 *   -h, --help          Show help
 */

function showHelp() {
  console.log(`
ChannelCoder - Channel your prompts to Claude Code

Usage:
  channelcoder <prompt-file> [options]   Execute prompt from file
  channelcoder -p "inline prompt" [options]   Execute inline prompt
  channelcoder --list-sessions   List all saved sessions
  
Options:
  -p, --prompt <text>      Use inline prompt instead of file
  -d, --data <key=value>   Data for interpolation (can be used multiple times)
  -s, --system <prompt>    System prompt (inline text or .md file path)
  -t, --tools <tools>      Allowed tools (space or comma-separated, e.g. "Read Write" or "Bash(git:*)")
  --disallowed-tools <tools>  Disallowed tools (comma-separated)
  --append-system <text>   Append to system prompt
  --mcp-config <file>      Load MCP servers from JSON file
  --permission-tool <tool> MCP tool for permission prompts
  -r, --resume <id>        Resume conversation by session ID
  -c, --continue           Continue most recent conversation
  --max-turns <n>          Limit agentic turns
  --session <name>         Use session mode with given name
  --load-session <name>    Load and continue existing session
  --list-sessions          List all saved sessions
  --docker                 Run in Docker container (auto-detect Dockerfile)
  --docker-image <image>   Use specific Docker image
  --docker-mount <mount>   Add Docker volume mount (can be used multiple times)
  --docker-env <key=val>   Add Docker environment variable (can be used multiple times)
  -v, --verbose            Verbose output
  -h, --help               Show this help

Examples:
  # Execute prompt file with data
  channelcoder prompts/analyze.md -d taskId=FEAT-123 -d context="Fix bug"
  
  # Inline prompt with system prompt
  channelcoder -p "Summarize: {text}" -d text="..." -s "Be concise"
  
  # Stream response with tools
  channelcoder prompts/generate.md --stream -t "Read Write"
  
  # Complex data via stdin
  echo '{"items": ["a", "b", "c"]}' | channelcoder prompts/process.md --data-stdin
  
  # Session management
  channelcoder prompts/debug.md --session my-debug
  channelcoder prompts/continue.md --load-session my-debug
  channelcoder --list-sessions
  
  # Docker mode
  channelcoder prompts/risky.md --docker
  channelcoder -p "Delete files" --docker-image claude-sandbox
  channelcoder analyze.md --docker-image my-claude --docker-mount ./data:/data:ro
`);
}

async function parseData(dataArgs: string[]): Promise<InterpolationData> {
  const data: InterpolationData = {};

  for (const arg of dataArgs) {
    const [key, ...valueParts] = arg.split('=');
    const value = valueParts.join('='); // Handle values with = in them

    if (!key) continue;

    // Try to parse as JSON first
    try {
      data[key] = JSON.parse(value);
    } catch {
      // If not JSON, treat as string
      // Handle special cases
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (value === 'null') data[key] = null;
      else if (value === 'undefined') data[key] = undefined;
      else if (/^-?\d+$/.test(value)) data[key] = Number.parseInt(value, 10);
      else if (/^-?\d+\.\d+$/.test(value)) data[key] = Number.parseFloat(value);
      else data[key] = value;
    }
  }

  return data;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      prompt: { type: 'string', short: 'p' },
      data: { type: 'string', short: 'd', multiple: true },
      'data-stdin': { type: 'boolean' },
      system: { type: 'string', short: 's' },
      'append-system': { type: 'string' },
      tools: { type: 'string', short: 't' },
      'disallowed-tools': { type: 'string' },
      'mcp-config': { type: 'string' },
      'permission-tool': { type: 'string' },
      resume: { type: 'string', short: 'r' },
      continue: { type: 'boolean', short: 'c' },
      'max-turns': { type: 'string' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
      session: { type: 'string' },
      'load-session': { type: 'string' },
      'list-sessions': { type: 'boolean' },
      docker: { type: 'boolean' },
      'docker-image': { type: 'string' },
      'docker-mount': { type: 'string', multiple: true },
      'docker-env': { type: 'string', multiple: true },
    },
    allowPositionals: true,
  });

  // Show help
  if (
    values.help ||
    (!values.prompt &&
      positionals.length === 0 &&
      !values['list-sessions'] &&
      !values.resume &&
      !values.continue &&
      !values.session &&
      !values['load-session'])
  ) {
    showHelp();
    process.exit(0);
  }

  try {
    // Handle list-sessions command
    if (values['list-sessions']) {
      const { session } = await import('./session.js');
      const sessions = await session.list();

      if (sessions.length === 0) {
        console.log('No saved sessions found.');
      } else {
        console.log('Saved sessions:');
        for (const sess of sessions) {
          console.log(
            `  ${sess.name} - ${sess.messageCount} messages (last active: ${sess.lastActive.toLocaleDateString()})`
          );
        }
      }
      process.exit(0);
    }
    // Parse data
    let data: InterpolationData = {};

    if (values['data-stdin']) {
      // Read JSON data from stdin
      const stdinData = await readStdin();
      try {
        data = JSON.parse(stdinData);
      } catch (e) {
        console.error('Error parsing stdin JSON:', e);
        process.exit(1);
      }
    }

    if (values.data) {
      // Merge command line data
      const cliData = await parseData(values.data);
      data = { ...data, ...cliData };
    }

    // Build options
    const options: Partial<ClaudeOptions> = {};

    // System prompt options
    if (values.system) {
      options.system = values.system;
    }
    if (values['append-system']) {
      options.appendSystem = values['append-system'];
    }

    // Tool options
    if (values.tools) {
      // Handle both comma and space separated tools
      // If contains comma, split by comma; otherwise split by space
      if (values.tools.includes(',')) {
        options.tools = values.tools.split(',').map((t) => t.trim());
      } else {
        options.tools = values.tools.split(/\s+/).filter((t) => t);
      }
    }
    if (values['disallowed-tools']) {
      const tools = values['disallowed-tools'];
      if (tools.includes(',')) {
        options.disallowedTools = tools.split(',').map((t) => t.trim());
      } else {
        options.disallowedTools = tools.split(/\s+/).filter((t) => t);
      }
    }

    // MCP options
    if (values['mcp-config']) {
      options.mcpConfig = values['mcp-config'];
    }
    if (values['permission-tool']) {
      options.permissionTool = values['permission-tool'];
    }

    // Conversation options
    if (values.resume) {
      options.resume = values.resume;
    }
    if (values.continue) {
      options.continue = true;
    }
    if (values['max-turns']) {
      options.maxTurns = Number.parseInt(values['max-turns'], 10);
    }

    if (values.verbose) {
      console.log('📊 Configuration:');
      console.log('  Data:', JSON.stringify(data, null, 2));
      console.log('  Options:', JSON.stringify(options, null, 2));
      console.log('');
    }

    // Add data to options
    if (Object.keys(data).length > 0) {
      options.data = data;
    }

    // Add verbose flag
    if (values.verbose) {
      options.verbose = true;
    }

    // Handle Docker options
    if (values.docker || values['docker-image']) {
      if (values['docker-image']) {
        options.docker = {
          image: values['docker-image'],
          mounts: values['docker-mount'] || [],
          env: {},
        };

        // Parse docker env vars
        if (values['docker-env']) {
          const env: Record<string, string> = {};
          for (const envVar of values['docker-env']) {
            const [key, ...valueParts] = envVar.split('=');
            if (key) {
              env[key] = valueParts.join('=');
            }
          }
          if (typeof options.docker === 'object' && options.docker !== null) {
            options.docker.env = { ...options.docker.env, ...env };
          }
        }
      } else {
        // Auto-detect mode with optional mounts/env
        options.docker = true;
        if (values['docker-mount'] || values['docker-env']) {
          options.docker = {
            auto: true,
            mounts: values['docker-mount'] || [],
            env: {},
          };

          // Parse docker env vars for auto mode
          if (values['docker-env']) {
            const env: Record<string, string> = {};
            for (const envVar of values['docker-env']) {
              const [key, ...valueParts] = envVar.split('=');
              if (key) {
                env[key] = valueParts.join('=');
              }
            }
            if (typeof options.docker === 'object' && options.docker !== null) {
              options.docker.env = { ...options.docker.env, ...env };
            }
          }
        }
      }
    }

    // Handle session mode
    if (values.session || values['load-session']) {
      const { session } = await import('./session.js');

      // Load or create session
      let s: Awaited<ReturnType<typeof session>>;
      if (values['load-session']) {
        s = await session.load(values['load-session']);
      } else {
        s = session({ name: values.session });
      }

      // Execute with session
      if (values.prompt) {
        await s.interactive(values.prompt, options);
      } else if (positionals.length > 0) {
        const promptFile = resolve(positionals[0]);
        await s.interactive(promptFile, options);
      } else {
        // Load session without additional prompt - just continue the conversation
        await s.interactive('', options);
      }

      // Save session if name provided
      if (values.session && typeof values.session === 'string') {
        await s.save(values.session);
      }

      process.exit(0);
    }

    // Handle resume-only mode (just -r with session ID, no prompt)
    if (values.resume && !values.prompt && positionals.length === 0) {
      // Resume without additional prompt - just continue the conversation
      await interactive('', options);
      process.exit(0);
    }

    // Handle continue-only mode (just -c, no prompt)
    if (values.continue && !values.prompt && positionals.length === 0) {
      // Continue without additional prompt
      await interactive('', options);
      process.exit(0);
    }

    // Launch Claude interactively
    // Note: interactive() replaces the current process, so code after this won't execute
    if (values.prompt) {
      // Inline prompt
      await interactive(values.prompt, options);
    } else {
      // File-based prompt
      const promptFile = resolve(positionals[0]);
      await interactive(promptFile, options);
    }

    // This code will never be reached because interactive() replaces the process
    console.error('❌ ERROR: Interactive mode failed to replace process');
    process.exit(1);
  } catch (error) {
    if (error instanceof Error) {
      // Check for common errors and provide helpful messages
      if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
        const fileMatch = error.message.match(/Failed to load prompt file ([^:]+)/);
        if (fileMatch) {
          console.error(`❌ Error: Prompt file not found: ${fileMatch[1]}`);
          console.error('💡 Make sure the file exists or use -p for inline prompts');
        } else {
          console.error('❌ Error: File not found');
          console.error(error.message);
        }
      } else if (error.message.includes('Input validation failed')) {
        console.error(`❌ ${error.message}`);
        console.error('💡 Check that all required fields are provided with -d');
      } else if (error.message.includes('Failed to launch Claude')) {
        console.error('❌ Error: Failed to launch Claude CLI');
        console.error(
          '💡 Make sure Claude CLI is installed: npm install -g @anthropic-ai/claude-code'
        );
      } else {
        // Other errors - show message without stack trace
        console.error('❌ Error:', error.message);
      }
    } else {
      console.error('❌ Fatal error:', error);
    }
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
