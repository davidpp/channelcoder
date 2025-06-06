# Stricli CLI Implementation Plan

## Overview

This document provides a detailed implementation plan for migrating ChannelCoder's CLI to Stricli while adding worktree support and maintaining backward compatibility.

## Directory Structure

```
src/
├── cli.ts                      # Entry point (updated to use Stricli)
├── cli/
│   ├── index.ts               # Main Stricli app definition
│   ├── compat.ts              # Backward compatibility layer
│   ├── utils.ts               # CLI utilities (formatting, etc.)
│   ├── types.ts               # Shared TypeScript types
│   ├── flags/
│   │   └── index.ts           # Shared flag definitions
│   └── commands/
│       ├── run.ts             # Main execution command (default)
│       ├── session/
│       │   ├── index.ts       # Session command router
│       │   ├── list.ts        # List sessions
│       │   ├── load.ts        # Load and continue session
│       │   └── remove.ts      # Remove session
│       ├── worktree/
│       │   ├── index.ts       # Worktree command router
│       │   ├── list.ts        # List worktrees
│       │   ├── create.ts      # Create worktree
│       │   ├── remove.ts      # Remove worktree
│       │   └── cleanup.ts     # Cleanup temporary worktrees
│       └── config/
│           └── init.ts        # Interactive configuration (future)
```

## Command Structure

### Main Commands

```bash
# Default run command (implicit)
channelcoder prompt.md [options]
channelcoder -p "inline prompt" [options]

# Explicit run command
channelcoder run prompt.md [options]

# Session commands
channelcoder session list
channelcoder session load <name>
channelcoder session remove <name>

# Worktree commands  
channelcoder worktree list
channelcoder worktree create <branch> [options]
channelcoder worktree remove <branch>
channelcoder worktree cleanup

# Future
channelcoder config init
```

### Global Flags (Available on all commands)

```typescript
--verbose, -v        # Verbose output
--help, -h          # Show help
--version           # Show version
```

### Run Command Flags

```typescript
// Prompt options
--prompt, -p <text>           # Inline prompt instead of file
--data, -d <key=value>        # Data for interpolation (multiple)
--data-stdin                  # Read JSON data from stdin

// System prompt options
--system, -s <prompt>         # System prompt (text or file)
--append-system <text>        # Append to system prompt

// Tool options
--tools, -t <tools>           # Allowed tools (comma/space separated)
--disallowed-tools <tools>    # Disallowed tools

// MCP options
--mcp-config <file>           # MCP server config
--permission-tool <tool>      # MCP permission tool

// Session options
--resume, -r <id>             # Resume by session ID
--continue, -c                # Continue most recent
--session <name>              # Use named session
--load-session <name>         # Load existing session

// Execution options
--max-turns <n>               # Limit agentic turns
--dangerously-skip-permissions # Skip permission prompts

// Docker options
--docker                      # Auto-detect Docker
--docker-image <image>        # Specific image
--docker-mount <mount>        # Volume mount (multiple)
--docker-env <key=value>      # Environment variable (multiple)

// Worktree options
--worktree, -w <branch>       # Use git worktree
--worktree-base <branch>      # Base branch for new worktree
--worktree-keep               # Keep worktree after execution
```

## File Implementations

### 1. `src/cli/types.ts`

```typescript
// Shared types for CLI
export interface CliGlobals {
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
}

export interface RunOptions extends CliGlobals {
  // Prompt
  prompt?: string;
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
  
  // Session
  resume?: string;
  continue?: boolean;
  session?: string;
  loadSession?: string;
  
  // Execution
  maxTurns?: number;
  dangerouslySkipPermissions?: boolean;
  
  // Docker
  docker?: boolean;
  dockerImage?: string;
  dockerMount?: string[];
  dockerEnv?: string[];
  
  // Worktree
  worktree?: string;
  worktreeBase?: string;
  worktreeKeep?: boolean;
}

export interface SessionListOptions extends CliGlobals {
  format?: 'table' | 'json' | 'simple';
}

export interface WorktreeCreateOptions extends CliGlobals {
  base?: string;
  path?: string;
  create?: boolean;
}
```

### 2. `src/cli/flags/index.ts`

```typescript
import { flag, flags as stricliFlags } from '@stricli/core';

// Global flags used across commands
export const globalFlags = {
  verbose: flag({
    kind: 'boolean',
    alias: 'v',
    default: false,
    docs: {
      description: 'Enable verbose output',
    },
  }),
};

// Data input flags
export const dataFlags = {
  data: flag({
    kind: 'parsed',
    alias: 'd',
    variadic: true,
    parse: (value) => value,
    docs: {
      description: 'Data for template interpolation (key=value)',
      example: '-d taskId=FEAT-123 -d priority=high',
    },
  }),
  dataStdin: flag({
    kind: 'boolean',
    default: false,
    docs: {
      description: 'Read JSON data from stdin',
    },
  }),
};

// System prompt flags
export const systemFlags = {
  system: flag({
    kind: 'parsed',
    alias: 's',
    parse: (value) => value,
    docs: {
      description: 'System prompt (inline text or .md file path)',
      example: '-s "Be concise" or -s prompts/expert.md',
    },
  }),
  appendSystem: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Append text to system prompt',
    },
  }),
};

// Tool configuration flags
export const toolFlags = {
  tools: flag({
    kind: 'parsed',
    alias: 't',
    parse: (value) => value,
    docs: {
      description: 'Allowed tools (comma or space separated)',
      example: '-t "Read Write" or -t "Bash(git:*),Grep"',
    },
  }),
  disallowedTools: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Disallowed tools',
    },
  }),
};

// Session flags
export const sessionFlags = {
  resume: flag({
    kind: 'parsed',
    alias: 'r',
    parse: (value) => value,
    docs: {
      description: 'Resume conversation by session ID',
    },
  }),
  continue: flag({
    kind: 'boolean',
    alias: 'c',
    default: false,
    docs: {
      description: 'Continue most recent conversation',
    },
  }),
  session: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Start or continue named session',
    },
  }),
  loadSession: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Load and continue existing session',
    },
  }),
};

// Docker flags
export const dockerFlags = {
  docker: flag({
    kind: 'boolean',
    default: false,
    docs: {
      description: 'Run in Docker container (auto-detect Dockerfile)',
    },
  }),
  dockerImage: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Use specific Docker image',
    },
  }),
  dockerMount: flag({
    kind: 'parsed',
    variadic: true,
    parse: (value) => value,
    docs: {
      description: 'Add Docker volume mount',
      example: '--docker-mount ./data:/data:ro',
    },
  }),
  dockerEnv: flag({
    kind: 'parsed',
    variadic: true,
    parse: (value) => value,
    docs: {
      description: 'Add Docker environment variable',
      example: '--docker-env NODE_ENV=production',
    },
  }),
};

// Worktree flags
export const worktreeFlags = {
  worktree: flag({
    kind: 'parsed',
    alias: 'w',
    parse: (value) => value,
    docs: {
      description: 'Run in git worktree (creates if needed)',
      example: '-w feature/auth',
    },
  }),
  worktreeBase: flag({
    kind: 'parsed',
    parse: (value) => value,
    docs: {
      description: 'Base branch for new worktree',
      example: '--worktree-base develop',
    },
  }),
  worktreeKeep: flag({
    kind: 'boolean',
    default: false,
    docs: {
      description: 'Keep worktree after execution',
    },
  }),
};
```

### 3. `src/cli/utils.ts`

```typescript
import { InterpolationData } from '../types.js';

/**
 * Parse key=value data arguments
 */
export async function parseDataArgs(dataArgs: string[]): Promise<InterpolationData> {
  const data: InterpolationData = {};

  for (const arg of dataArgs) {
    const [key, ...valueParts] = arg.split('=');
    const value = valueParts.join('=');

    if (!key) continue;

    // Try to parse as JSON first
    try {
      data[key] = JSON.parse(value);
    } catch {
      // Smart type conversion
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

/**
 * Read JSON from stdin
 */
export async function readStdinJson(): Promise<InterpolationData> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(input);
}

/**
 * Parse tool list from CLI input
 */
export function parseTools(toolString: string): string[] {
  if (toolString.includes(',')) {
    return toolString.split(',').map(t => t.trim());
  } else {
    return toolString.split(/\s+/).filter(t => t);
  }
}

/**
 * Parse Docker environment variables
 */
export function parseDockerEnv(envArgs: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const envVar of envArgs) {
    const [key, ...valueParts] = envVar.split('=');
    if (key) {
      env[key] = valueParts.join('=');
    }
  }
  return env;
}

/**
 * Format session list for display
 */
export function formatSessionList(sessions: Array<{
  name: string;
  messageCount: number;
  lastActive: Date;
}>, format: 'table' | 'json' | 'simple' = 'table'): string {
  if (format === 'json') {
    return JSON.stringify(sessions, null, 2);
  }

  if (sessions.length === 0) {
    return 'No saved sessions found.';
  }

  if (format === 'simple') {
    return sessions.map(s => s.name).join('\n');
  }

  // Table format
  let output = 'Saved sessions:\n';
  for (const sess of sessions) {
    output += `  ${sess.name} - ${sess.messageCount} messages (last active: ${sess.lastActive.toLocaleDateString()})\n`;
  }
  return output;
}

/**
 * Format worktree list for display
 */
export function formatWorktreeList(worktrees: Array<{
  branch: string;
  path: string;
  commit?: string;
}>, format: 'table' | 'json' | 'simple' = 'table'): string {
  if (format === 'json') {
    return JSON.stringify(worktrees, null, 2);
  }

  if (worktrees.length === 0) {
    return 'No git worktrees found.';
  }

  if (format === 'simple') {
    return worktrees.map(w => w.branch).join('\n');
  }

  // Table format
  let output = 'Git worktrees:\n';
  for (const wt of worktrees) {
    output += `  ${wt.branch} - ${wt.path}`;
    if (wt.commit) {
      output += ` (${wt.commit.substring(0, 7)})`;
    }
    output += '\n';
  }
  return output;
}
```

### 4. `src/cli/commands/run.ts`

```typescript
import { buildCommand, positional } from '@stricli/core';
import { interactive } from '../../index.js';
import { 
  globalFlags, 
  dataFlags, 
  systemFlags, 
  toolFlags, 
  sessionFlags,
  dockerFlags,
  worktreeFlags 
} from '../flags/index.js';
import { parseDataArgs, readStdinJson, parseTools, parseDockerEnv } from '../utils.js';
import type { ClaudeOptions } from '../../types.js';

export const runCommand = buildCommand({
  docs: {
    description: 'Run Claude with a prompt (default command)',
    examples: [
      {
        command: 'channelcoder prompt.md -d taskId=123',
        description: 'Run with file prompt and data',
      },
      {
        command: 'channelcoder -p "Explain this" --docker',
        description: 'Run inline prompt in Docker',
      },
    ],
  },
  parameters: {
    positional: {
      promptFile: positional({
        kind: 'string',
        optionality: 'optional',
        docs: {
          description: 'Prompt file path',
        },
      }),
    },
    flags: {
      ...globalFlags,
      ...dataFlags,
      ...systemFlags,
      ...toolFlags,
      ...sessionFlags,
      ...dockerFlags,
      ...worktreeFlags,
      
      // Additional run-specific flags
      prompt: flag({
        kind: 'parsed',
        alias: 'p',
        parse: (value) => value,
        docs: {
          description: 'Inline prompt instead of file',
        },
      }),
      maxTurns: flag({
        kind: 'parsed',
        parse: (value) => parseInt(value, 10),
        docs: {
          description: 'Limit number of agentic turns',
        },
      }),
      dangerouslySkipPermissions: flag({
        kind: 'boolean',
        default: false,
        docs: {
          description: 'Skip permission prompts (use with caution)',
        },
      }),
    },
  },
  async run({ flags, positional }) {
    // Parse data
    let data = {};
    if (flags.dataStdin) {
      data = await readStdinJson();
    }
    if (flags.data) {
      const cliData = await parseDataArgs(flags.data);
      data = { ...data, ...cliData };
    }

    // Build options
    const options: Partial<ClaudeOptions> = {};
    
    // Add data
    if (Object.keys(data).length > 0) {
      options.data = data;
    }

    // System prompts
    if (flags.system) options.system = flags.system;
    if (flags.appendSystem) options.appendSystem = flags.appendSystem;

    // Tools
    if (flags.tools) options.tools = parseTools(flags.tools);
    if (flags.disallowedTools) options.disallowedTools = parseTools(flags.disallowedTools);

    // Session
    if (flags.resume) options.resume = flags.resume;
    if (flags.continue) options.continue = true;

    // Execution
    if (flags.maxTurns) options.maxTurns = flags.maxTurns;
    if (flags.dangerouslySkipPermissions) options.dangerouslySkipPermissions = true;
    if (flags.verbose) options.verbose = true;

    // Docker
    if (flags.docker || flags.dockerImage) {
      if (flags.dockerImage) {
        options.docker = {
          image: flags.dockerImage,
          mounts: flags.dockerMount || [],
          env: flags.dockerEnv ? parseDockerEnv(flags.dockerEnv) : {},
        };
      } else {
        options.docker = true;
        if (flags.dockerMount || flags.dockerEnv) {
          options.docker = {
            auto: true,
            mounts: flags.dockerMount || [],
            env: flags.dockerEnv ? parseDockerEnv(flags.dockerEnv) : {},
          };
        }
      }
    }

    // Worktree
    if (flags.worktree) {
      options.worktree = {
        branch: flags.worktree,
        base: flags.worktreeBase,
        cleanup: !flags.worktreeKeep,
      };
    }

    // Handle session mode
    if (flags.session || flags.loadSession) {
      const { session } = await import('../../session.js');
      
      let s;
      if (flags.loadSession) {
        s = await session.load(flags.loadSession);
      } else {
        s = session({ name: flags.session });
      }

      // Execute with session
      const promptSource = flags.prompt || positional.promptFile || '';
      await s.interactive(promptSource, options);

      if (flags.session) {
        await s.save(flags.session);
      }
      return;
    }

    // Regular execution
    const promptSource = flags.prompt || positional.promptFile || '';
    await interactive(promptSource, options);
  },
});
```

### 5. `src/cli/commands/session/list.ts`

```typescript
import { buildCommand } from '@stricli/core';
import { session } from '../../../session.js';
import { globalFlags } from '../../flags/index.js';
import { formatSessionList } from '../../utils.js';

export const listCommand = buildCommand({
  docs: {
    description: 'List all saved sessions',
  },
  parameters: {
    flags: {
      ...globalFlags,
      format: flag({
        kind: 'enum',
        values: ['table', 'json', 'simple'],
        default: 'table',
        docs: {
          description: 'Output format',
        },
      }),
    },
  },
  async run({ flags }) {
    const sessions = await session.list();
    console.log(formatSessionList(sessions, flags.format));
  },
});
```

### 6. `src/cli/commands/session/load.ts`

```typescript
import { buildCommand, positional } from '@stricli/core';
import { session } from '../../../session.js';
import { globalFlags } from '../../flags/index.js';

export const loadCommand = buildCommand({
  docs: {
    description: 'Load and continue an existing session',
  },
  parameters: {
    positional: {
      name: positional({
        kind: 'string',
        docs: {
          description: 'Session name to load',
        },
      }),
    },
    flags: globalFlags,
  },
  async run({ positional, flags }) {
    const s = await session.load(positional.name);
    
    // Launch interactive mode with loaded session
    await s.interactive('', {
      verbose: flags.verbose,
    });
  },
});
```

### 7. `src/cli/commands/worktree/list.ts`

```typescript
import { buildCommand } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags } from '../../flags/index.js';
import { formatWorktreeList } from '../../utils.js';

export const listCommand = buildCommand({
  docs: {
    description: 'List all git worktrees',
  },
  parameters: {
    flags: {
      ...globalFlags,
      format: flag({
        kind: 'enum',
        values: ['table', 'json', 'simple'],
        default: 'table',
        docs: {
          description: 'Output format',
        },
      }),
    },
  },
  async run({ flags }) {
    const worktrees = await worktreeUtils.list();
    console.log(formatWorktreeList(worktrees, flags.format));
  },
});
```

### 8. `src/cli/commands/worktree/create.ts`

```typescript
import { buildCommand, positional } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags } from '../../flags/index.js';

export const createCommand = buildCommand({
  docs: {
    description: 'Create a new git worktree',
  },
  parameters: {
    positional: {
      branch: positional({
        kind: 'string',
        docs: {
          description: 'Branch name for the worktree',
        },
      }),
    },
    flags: {
      ...globalFlags,
      base: flag({
        kind: 'parsed',
        parse: (value) => value,
        docs: {
          description: 'Base branch for new worktree',
        },
      }),
      path: flag({
        kind: 'parsed',
        parse: (value) => value,
        docs: {
          description: 'Custom path for worktree',
        },
      }),
    },
  },
  async run({ positional, flags }) {
    const worktree = await worktreeUtils.create(positional.branch, {
      base: flags.base,
      path: flags.path,
    });
    
    console.log(`Created worktree:`);
    console.log(`  Branch: ${worktree.branch}`);
    console.log(`  Path: ${worktree.path}`);
    if (worktree.autoCreated) {
      console.log(`  Note: Branch was created from ${flags.base || 'current branch'}`);
    }
  },
});
```

### 9. `src/cli/commands/session/index.ts` (Router)

```typescript
import { buildRouteCommand } from '@stricli/core';
import { listCommand } from './list.js';
import { loadCommand } from './load.js';
import { removeCommand } from './remove.js';

export const sessionCommand = buildRouteCommand({
  docs: {
    description: 'Manage Claude sessions',
  },
  routes: {
    list: listCommand,
    load: loadCommand,
    remove: removeCommand,
  },
});
```

### 10. `src/cli/commands/worktree/index.ts` (Router)

```typescript
import { buildRouteCommand } from '@stricli/core';
import { listCommand } from './list.js';
import { createCommand } from './create.js';
import { removeCommand } from './remove.js';
import { cleanupCommand } from './cleanup.js';

export const worktreeCommand = buildRouteCommand({
  docs: {
    description: 'Manage git worktrees',
  },
  routes: {
    list: listCommand,
    create: createCommand,
    remove: removeCommand,
    cleanup: cleanupCommand,
  },
});
```

### 11. `src/cli/index.ts` (Main App)

```typescript
import { buildApplication } from '@stricli/core';
import { runCommand } from './commands/run.js';
import { sessionCommand } from './commands/session/index.js';
import { worktreeCommand } from './commands/worktree/index.js';

export const app = buildApplication({
  name: 'channelcoder',
  docs: {
    brief: 'Channel your prompts to Claude Code',
    description: `
ChannelCoder - A streamlined SDK and CLI for Claude Code

Examples:
  channelcoder prompt.md -d taskId=123
  channelcoder -p "Explain this" --docker
  channelcoder session list
  channelcoder worktree create feature/auth
    `.trim(),
  },
  commands: {
    // Default command (run)
    run: runCommand,
    
    // Subcommands
    session: sessionCommand,
    worktree: worktreeCommand,
  },
  // Default to run command when no subcommand specified
  defaultCommand: 'run',
});
```

### 12. `src/cli/compat.ts` (Backward Compatibility)

```typescript
import type { ParsedArgs } from 'util';
import { app } from './index.js';

/**
 * Transform old-style flags to new command structure
 */
export function transformLegacyArgs(values: ParsedArgs['values']): string[] {
  const args: string[] = [];

  // Transform --list-sessions to session list
  if (values['list-sessions']) {
    return ['session', 'list'];
  }

  // Transform --load-session to session load
  if (values['load-session']) {
    return ['session', 'load', values['load-session'] as string];
  }

  // Transform --list-worktrees to worktree list
  if (values['list-worktrees']) {
    return ['worktree', 'list'];
  }

  // Transform --remove-worktree to worktree remove
  if (values['remove-worktree']) {
    return ['worktree', 'remove', values['remove-worktree'] as string];
  }

  // Transform --cleanup-worktrees to worktree cleanup
  if (values['cleanup-worktrees']) {
    return ['worktree', 'cleanup'];
  }

  // Otherwise, use run command with all flags
  args.push('run');
  
  // Add all other flags as-is
  for (const [key, value] of Object.entries(values)) {
    if (value === true) {
      args.push(`--${key}`);
    } else if (value !== false && value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) {
          args.push(`--${key}`, String(v));
        }
      } else {
        args.push(`--${key}`, String(value));
      }
    }
  }

  return args;
}
```

### 13. `src/cli.ts` (Updated Entry Point)

```typescript
#!/usr/bin/env node

import { run } from '@stricli/core/node';
import { app } from './cli/index.js';
import { parseArgs } from 'util';
import { transformLegacyArgs } from './cli/compat.js';

// Check if using legacy style
const isPotentiallyLegacy = process.argv.some(arg => 
  arg.startsWith('--list-sessions') ||
  arg.startsWith('--load-session') ||
  arg.startsWith('--list-worktrees') ||
  arg.startsWith('--remove-worktree') ||
  arg.startsWith('--cleanup-worktrees')
);

if (isPotentiallyLegacy) {
  // Parse with util.parseArgs for legacy support
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'list-sessions': { type: 'boolean' },
      'load-session': { type: 'string' },
      'list-worktrees': { type: 'boolean' },
      'remove-worktree': { type: 'string' },
      'cleanup-worktrees': { type: 'boolean' },
    },
    strict: false,
    allowPositionals: true,
  });

  // Transform to new style
  const newArgs = transformLegacyArgs(values);
  
  // Add positionals
  if (positionals.length > 0) {
    newArgs.push(...positionals);
  }

  // Run with transformed args
  await run(app, newArgs);
} else {
  // Use Stricli directly
  await run(app, process.argv.slice(2));
}
```

## Testing Plan

### 1. Backward Compatibility Tests

```bash
# Old style should still work
channelcoder prompt.md -d key=value
channelcoder --list-sessions
channelcoder --load-session my-session

# Should map to new commands internally
```

### 2. New Command Tests

```bash
# Session commands
channelcoder session list
channelcoder session list --format json
channelcoder session load my-session
channelcoder session remove old-session

# Worktree commands
channelcoder worktree list
channelcoder worktree create feature/test --base main
channelcoder worktree remove feature/old
channelcoder worktree cleanup

# Run with worktree
channelcoder prompt.md -w feature/auth
channelcoder run prompt.md --worktree feature/api --worktree-base develop
```

### 3. Help System Tests

```bash
channelcoder --help              # Main help
channelcoder run --help          # Run command help
channelcoder session --help      # Session subcommands
channelcoder worktree --help     # Worktree subcommands
```

## Implementation Order

1. **Setup Phase**
   - Install Stricli
   - Create directory structure
   - Define types and shared flags

2. **Core Implementation**
   - Build main app structure
   - Implement run command
   - Add backward compatibility

3. **Session Commands**
   - Implement list, load, remove
   - Test with existing session functionality

4. **Worktree Commands**
   - Implement list, create, remove, cleanup
   - Test with worktree utilities

5. **Polish Phase**
   - Refine help text
   - Add examples
   - Test all edge cases
   - Update documentation

## Success Criteria

1. All existing CLI commands work without changes
2. New subcommand structure is intuitive
3. Help system is well-organized
4. TypeScript catches CLI errors at compile time
5. Easy to add new commands in the future
6. Performance is not degraded