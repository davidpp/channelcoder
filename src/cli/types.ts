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