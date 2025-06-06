// Stricli doesn't export flags directly, we'll create our own flag builder functions
import type { TypedFlagParameter } from '@stricli/core';
import { numberParser } from '@stricli/core';

// Global flags used across commands
export const globalFlags = {
  verbose: {
    kind: 'boolean' as const,
    brief: 'Enable verbose output',
    default: false,
  } satisfies TypedFlagParameter<boolean>,
};

// Data input flags
export const dataFlags = {
  data: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Data for template interpolation (key=value)',
    optional: true,
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
    parse: (value: string) => value,
    brief: 'System prompt (inline text or .md file path)',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  appendSystem: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Append text to system prompt',
    optional: true,
  } satisfies TypedFlagParameter<string>,
};

// Tool configuration flags
export const toolFlags = {
  tools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Allowed tools (comma or space separated)',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  disallowedTools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Disallowed tools',
    optional: true,
  } satisfies TypedFlagParameter<string>,
};

// Session flags
export const sessionFlags = {
  resume: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Resume conversation by session ID',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  continue: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Continue most recent conversation',
  } satisfies TypedFlagParameter<boolean>,
  session: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Start or continue named session',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  loadSession: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Load and continue existing session',
    optional: true,
  } satisfies TypedFlagParameter<string>,
};

// MCP flags
export const mcpFlags = {
  mcpConfig: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP server configuration file',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  permissionTool: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'MCP permission prompt tool',
    optional: true,
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
    optional: true,
  } satisfies TypedFlagParameter<string>,
  dockerMount: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Add Docker volume mount',
    optional: true,
  } satisfies TypedFlagParameter<string[]>,
  dockerEnv: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Add Docker environment variable',
    optional: true,
  } satisfies TypedFlagParameter<string[]>,
};

// Worktree flags
export const worktreeFlags = {
  worktree: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Run in git worktree (creates if needed)',
    optional: true,
  } satisfies TypedFlagParameter<string>,
  worktreeBase: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Base branch for new worktree',
    optional: true,
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
    optional: true,
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

