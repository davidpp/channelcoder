// Stricli doesn't export flags directly, we'll create our own flag builder functions
import type { TypedFlagParameter } from '@stricli/core';
import { numberParser } from '@stricli/core';

// Global flags used across commands
export const globalFlags = {
  verbose: {
    kind: 'boolean' as const,
    alias: 'v',
    brief: 'Enable verbose output',
    default: false,
  } satisfies TypedFlagParameter<boolean>,
};

// Data input flags
export const dataFlags = {
  data: {
    kind: 'parsed' as const,
    alias: 'd',
    variadic: true,
    parse: (value: string) => value,
    brief: 'Data for template interpolation (key=value)',
  } satisfies TypedFlagParameter<string[]>,
  dataStdin: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Read JSON data from stdin',
  } satisfies TypedFlagParameter<boolean>,
};

// System prompt flags
export const systemFlags = {
  system: {
    kind: 'parsed' as const,
    alias: 's',
    parse: (value: string) => value,
    brief: 'System prompt (inline text or .md file path)',
  } satisfies TypedFlagParameter<string>,
  appendSystem: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Append text to system prompt',
  } satisfies TypedFlagParameter<string>,
};

// Tool configuration flags
export const toolFlags = {
  tools: {
    kind: 'parsed' as const,
    alias: 't',
    parse: (value: string) => value,
    brief: 'Allowed tools (comma or space separated)',
  } satisfies TypedFlagParameter<string>,
  disallowedTools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Disallowed tools',
  } satisfies TypedFlagParameter<string>,
};

// Session flags
export const sessionFlags = {
  resume: {
    kind: 'parsed' as const,
    alias: 'r',
    parse: (value: string) => value,
    brief: 'Resume conversation by session ID',
  } satisfies TypedFlagParameter<string>,
  continue: {
    kind: 'boolean' as const,
    alias: 'c',
    default: false,
    brief: 'Continue most recent conversation',
  } satisfies TypedFlagParameter<boolean>,
  session: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Start or continue named session',
  } satisfies TypedFlagParameter<string>,
  loadSession: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Load and continue existing session',
  } satisfies TypedFlagParameter<string>,
};

// MCP flags
export const mcpFlags = {
  mcpConfig: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP server configuration file',
  } satisfies TypedFlagParameter<string>,
  permissionTool: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP permission prompt tool',
  } satisfies TypedFlagParameter<string>,
};

// Docker flags
export const dockerFlags = {
  docker: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Run in Docker container (auto-detect Dockerfile)',
  } satisfies TypedFlagParameter<boolean>,
  dockerImage: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Use specific Docker image',
  } satisfies TypedFlagParameter<string>,
  dockerMount: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Add Docker volume mount',
  } satisfies TypedFlagParameter<string[]>,
  dockerEnv: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Add Docker environment variable',
  } satisfies TypedFlagParameter<string[]>,
};

// Worktree flags
export const worktreeFlags = {
  worktree: {
    kind: 'parsed' as const,
    alias: 'w',
    parse: (value: string) => value,
    brief: 'Run in git worktree (creates if needed)',
  } satisfies TypedFlagParameter<string>,
  worktreeBase: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Base branch for new worktree',
  } satisfies TypedFlagParameter<string>,
  worktreeKeep: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Keep worktree after execution',
  } satisfies TypedFlagParameter<boolean>,
};

// Additional execution flags
export const executionFlags = {
  maxTurns: {
    kind: 'parsed' as const,
    parse: numberParser,
    brief: 'Limit number of agentic turns',
  } satisfies TypedFlagParameter<number>,
  dangerouslySkipPermissions: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Skip permission prompts (use with caution)',
  } satisfies TypedFlagParameter<boolean>,
};

// Format flag for list commands
export const formatFlag = {
  kind: 'enum' as const,
  values: ['table', 'json', 'simple'] as const,
  default: 'table' as const,
  brief: 'Output format',
} satisfies TypedFlagParameter<'table' | 'json' | 'simple'>;

// Prompt flag
export const promptFlag = {
  kind: 'parsed' as const,
  alias: 'p',
  parse: (value: string) => value,
  brief: 'Inline prompt instead of file',
} satisfies TypedFlagParameter<string>;