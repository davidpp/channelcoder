// Stricli doesn't export flags directly, we'll create our own flag builder functions
import type { TypedFlagParameter } from '@stricli/core';
import { numberParser } from '@stricli/core';

// Global flags used across commands
export const globalFlags = {
  verbose: {
    kind: 'boolean' as const,
    brief: 'Enable verbose output',
    optional: true as const,
  },
};

// Data input flags
export const dataFlags = {
  data: {
    kind: 'parsed' as const,
    variadic: true as const,
    parse: (value: string) => value,
    brief: 'Data for template interpolation (key=value)',
    optional: true as const,
  },
  dataStdin: {
    kind: 'boolean' as const,
    brief: 'Read JSON data from stdin',
    optional: true as const,
  },
};

// System prompt flags
export const systemFlags = {
  system: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'System prompt (inline text or .md file path)',
    optional: true as const,
  },
  appendSystem: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Append text to system prompt',
    optional: true as const,
  },
};

// Tool configuration flags
export const toolFlags = {
  tools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Allowed tools (comma or space separated)',
    optional: true as const,
  },
  disallowedTools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Disallowed tools',
    optional: true as const,
  },
};

// Session flags
export const sessionFlags = {
  resume: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Resume conversation by session ID',
    optional: true as const,
  },
  continue: {
    kind: 'boolean' as const,
    brief: 'Continue most recent conversation',
    optional: true as const,
  },
  session: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Start or continue named session',
    optional: true as const,
  },
  loadSession: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Load and continue existing session',
    optional: true as const,
  },
};

// MCP flags
export const mcpFlags = {
  mcpConfig: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP server configuration file',
    optional: true as const,
  },
  permissionTool: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP permission prompt tool',
    optional: true as const,
  },
};

// Docker flags
export const dockerFlags = {
  docker: {
    kind: 'boolean' as const,
    brief: 'Run in Docker container (auto-detect Dockerfile)',
    optional: true as const,
  },
  dockerImage: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Use specific Docker image',
    optional: true as const,
  },
  dockerMount: {
    kind: 'parsed' as const,
    variadic: true as const,
    parse: (value: string) => value,
    brief: 'Add Docker volume mount',
    optional: true as const,
  },
  dockerEnv: {
    kind: 'parsed' as const,
    variadic: true as const,
    parse: (value: string) => value,
    brief: 'Add Docker environment variable',
    optional: true as const,
  },
};

// Worktree flags
export const worktreeFlags = {
  worktree: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Run in git worktree (creates if needed)',
    optional: true as const,
  },
  worktreeBase: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Base branch for new worktree',
    optional: true as const,
  },
};

// Additional execution flags
export const executionFlags = {
  maxTurns: {
    kind: 'parsed' as const,
    parse: numberParser,
    brief: 'Limit number of agentic turns',
    optional: true as const,
  },
  dangerouslySkipPermissions: {
    kind: 'boolean' as const,
    brief: 'Skip permission prompts (use with caution)',
    optional: true as const,
  },
};

// Format flag for list commands
export const formatFlag = {
  kind: 'enum' as const,
  values: ['table', 'json', 'simple'] as const,
  brief: 'Output format',
  optional: true as const,
};
