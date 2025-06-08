import { type CommandContext, buildCommand } from '@stricli/core';
import { stream } from '../../index.js';
import type { ClaudeOptions } from '../../types.js';
import {
  dataFlags,
  executionFlags,
  globalFlags,
  mcpFlags,
  systemFlags,
  toolFlags,
} from '../flags/index.js';
import { parseDataArgs, parseTools, readStdinJson } from '../utils.js';

interface StreamFlags {
  // Data
  data?: string[];
  dataStdin?: boolean;

  // System
  system?: string;
  appendSystem?: string;

  // Tools
  tools?: string;
  disallowedTools?: string;

  // MCP
  mcpConfig?: string;
  permissionTool?: string;

  // Execution
  maxTurns?: number;
  dangerouslySkipPermissions?: boolean;
  verbose?: boolean;
  parse?: boolean;
}

/**
 * Parse data from flags
 */
async function parseData(flags: StreamFlags): Promise<Record<string, any>> {
  let data = {};

  if (flags.dataStdin) {
    data = await readStdinJson();
  }

  if (flags.data) {
    const cliData = await parseDataArgs(flags.data);
    data = { ...data, ...cliData };
  }

  return data;
}

/**
 * Build Claude options from flags
 */
function buildOptions(flags: StreamFlags, data: Record<string, any>): Partial<ClaudeOptions> {
  const options: Partial<ClaudeOptions> = {};

  // Data
  if (Object.keys(data).length > 0) {
    options.data = data;
  }

  // System prompts
  if (flags.system) options.system = flags.system;
  if (flags.appendSystem) options.appendSystem = flags.appendSystem;

  // Tools
  if (flags.tools) options.tools = parseTools(flags.tools);
  if (flags.disallowedTools) options.disallowedTools = parseTools(flags.disallowedTools);

  // MCP
  if (flags.mcpConfig) options.mcpConfig = flags.mcpConfig;
  if (flags.permissionTool) options.permissionTool = flags.permissionTool;

  // Execution
  if (flags.maxTurns !== undefined) options.maxTurns = flags.maxTurns;
  if (flags.dangerouslySkipPermissions) options.dangerouslySkipPermissions = true;
  if (flags.verbose) options.verbose = true;
  // Default to parsing (extracting content) unless --parse flag is used for raw JSON
  options.parse = !flags.parse;

  return options;
}

export const streamCommand = buildCommand({
  docs: {
    brief: 'Stream responses in real-time',
    customUsage: [
      '"Analyze this data" --parse',
      'generate.md -d template=component',
      'chat.md --max-turns 10',
    ],
  },
  async func(this: CommandContext, flags: StreamFlags, promptFile?: string) {
    // Parse data
    const data = await parseData(flags);

    // Build options
    const options = buildOptions(flags, data);

    // Determine prompt source from positional argument
    const promptSource = promptFile || '';

    if (!promptSource) {
      this.process.stderr.write('Error: Prompt file or text is required\n');
      this.process.exit(1);
      return;
    }

    // Stream responses
    try {
      for await (const chunk of stream(promptSource, options)) {
        // The parse option has been inverted - when false (default), we output content
        // When true (--parse flag), we output raw JSON
        if (!flags.parse) {
          // Default: Output content only
          if (chunk.type === 'content' && chunk.content) {
            this.process.stdout.write(chunk.content);
          } else if (chunk.type === 'error') {
            this.process.stderr.write(`Error: ${chunk.content}\n`);
          }
        } else {
          // --parse flag: Output raw JSON chunks
          this.process.stdout.write(JSON.stringify(chunk) + '\n');
        }
      }
    } catch (error) {
      this.process.stderr.write(`Error: ${error}\n`);
      this.process.exit(1);
    }
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Prompt text or file path',
          parse: String,
          optional: true,
        },
      ],
    },
    flags: {
      ...globalFlags,
      ...dataFlags,
      ...systemFlags,
      ...toolFlags,
      ...mcpFlags,
      ...executionFlags,
      parse: {
        kind: 'boolean' as const,
        default: false,
        brief: 'Output raw JSON chunks instead of content',
      } as const,
    },
    aliases: {
      // Data aliases
      d: 'data',
      // System aliases
      s: 'system',
      // Tool aliases
      t: 'tools',
      // Global aliases
      v: 'verbose',
    },
  },
});
