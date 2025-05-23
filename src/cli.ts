#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { cc } from './index.js';
import type { InterpolationData, RunOptions } from './types.js';

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
  
  (or use the short alias 'cc' instead of 'channelcoder')
  
Options:
  -p, --prompt <text>      Use inline prompt instead of file
  -d, --data <key=value>   Data for interpolation (can be used multiple times)
  -s, --system <prompt>    System prompt (inline text or .md file path)
  -t, --tools <tools>      Allowed tools (space or comma-separated, e.g. "Read Write" or "Bash(git:*)")
  --stream                 Stream output
  -v, --verbose            Verbose output
  --json                   Output JSON only (no formatting)
  -h, --help               Show this help

Examples:
  # Execute prompt file with data
  cc prompts/analyze.md -d taskId=FEAT-123 -d context="Fix bug"
  
  # Inline prompt with system prompt
  cc -p "Summarize: \${text}" -d text="..." -s "Be concise"
  
  # Stream response with tools
  cc prompts/generate.md --stream -t "Read Write"
  
  # Complex data via stdin
  echo '{"items": ["a", "b", "c"]}' | cc prompts/process.md --data-stdin
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
      tools: { type: 'string', short: 't' },
      stream: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  // Show help
  if (values.help || (!values.prompt && positionals.length === 0)) {
    showHelp();
    process.exit(0);
  }

  try {
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
    const options: Partial<RunOptions> = {};

    if (values.system) {
      options.systemPrompt = values.system;
    }

    if (values.tools) {
      // Handle both comma and space separated tools
      // If contains comma, split by comma; otherwise split by space
      if (values.tools.includes(',')) {
        options.allowedTools = values.tools.split(',').map((t) => t.trim());
      } else {
        options.allowedTools = values.tools.split(/\s+/).filter((t) => t);
      }
    }

    if (values.verbose) {
      console.log('📊 Configuration:');
      console.log('  Data:', JSON.stringify(data, null, 2));
      console.log('  Options:', JSON.stringify(options, null, 2));
      console.log('');
    }

    // Execute prompt
    if (values.stream) {
      // Streaming mode
      let prompt: string;

      if (values.prompt) {
        // Inline prompt - need to interpolate manually
        const template = new (await import('./template.js')).PromptTemplate();
        const interpolated = template.interpolate(values.prompt, data);
        prompt = interpolated;
      } else {
        // File-based prompt
        const promptFile = resolve(positionals[0]);
        if (values.verbose) {
          console.log(`📄 Loading prompt from: ${promptFile}`);
        }

        // For streaming with file, we need to handle this differently
        // Load the file, get config, then stream
        const { loadPromptFile } = await import('./loader.js');
        const { config, content } = await loadPromptFile(promptFile);
        const template = new (await import('./template.js')).PromptTemplate();
        const interpolated = template.interpolate(content, data);

        // Merge file config with CLI options
        Object.assign(options, config, options); // CLI options override file config
        prompt = interpolated;
      }

      console.log('🔄 Streaming response...\n');

      for await (const chunk of cc.stream(prompt, options)) {
        if (chunk.type === 'content') {
          process.stdout.write(chunk.content);
        } else if (chunk.type === 'error') {
          console.error('\n❌ Error:', chunk.content);
        } else if (values.verbose) {
          console.log(`\n[${chunk.type}]`, chunk.content);
        }
      }
      console.log('\n');
    } else {
      // Normal execution
      let result: Awaited<ReturnType<typeof cc.run>>;

      if (values.prompt) {
        // Inline prompt
        const template = new (await import('./template.js')).PromptTemplate();
        const interpolated = template.interpolate(values.prompt, data);

        if (values.verbose) {
          console.log('📝 Executing inline prompt');
        }

        result = await cc.run(interpolated, options);
      } else {
        // File-based prompt
        const promptFile = resolve(positionals[0]);
        if (values.verbose) {
          console.log(`📄 Loading prompt from: ${promptFile}`);
        }

        result = await cc.fromFile(promptFile, data);
      }

      // Output results
      if (result.success) {
        if (result.data) {
          if (values.json) {
            // Raw JSON output
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            // Formatted output
            console.log('✅ Success!\n');
            console.log('📊 Data:');
            console.log(JSON.stringify(result.data, null, 2));
          }
        } else if (result.stdout) {
          if (!values.json) {
            console.log('✅ Response:\n');
          }
          console.log(result.stdout);
        }

        if (result.warnings && result.warnings.length > 0 && values.verbose) {
          console.log('\n⚠️  Warnings:');
          for (const w of result.warnings) {
            console.log(`  - ${w}`);
          }
        }
      } else {
        console.error('❌ Error:', result.error);
        if (result.stderr && values.verbose) {
          console.error('\n📋 Stderr:', result.stderr);
        }
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run CLI
if (import.meta.main) {
  main();
}
