import type { z } from 'zod';

/**
 * Result from CC (Claude Code) execution
 */
export interface CCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  warnings?: string[];
  sessionId?: string; // Session ID from Claude CLI response

  // Detached process information
  pid?: number;
  detached?: boolean;
  logFile?: string;
  streaming?: boolean;
}

/**
 * Configuration for prompts (from frontmatter or programmatic)
 */
export interface PromptConfig {
  // Input schema for validation
  input?: z.ZodSchema | Record<string, z.ZodType>;

  // Output schema for parsing
  output?: z.ZodSchema | Record<string, z.ZodType>;

  // System prompt (inline string or file path)
  systemPrompt?: string;

  // Append to system prompt (only with --print)
  appendSystemPrompt?: string;

  // Claude CLI tool options
  allowedTools?: string[];
  disallowedTools?: string[];

  // MCP configuration
  mcpConfig?: string;
  permissionPromptTool?: string;

  // Session configuration
  session?: {
    required?: boolean;
  };
}

/**
 * Options for CC SDK instance
 */
export interface CCOptions {
  // Default timeout in milliseconds
  timeout?: number;

  // Default verbose mode
  verbose?: boolean;

  // Default output format
  outputFormat?: 'json' | 'stream-json' | 'text';

  // Conversation options
  resume?: string; // Resume by session ID
  continue?: boolean; // Continue most recent conversation
  maxTurns?: number; // Limit agentic turns in non-interactive mode

  // Execution mode
  mode?: 'run' | 'stream' | 'interactive';

  // Docker execution options
  docker?: boolean | DockerOptions;

  // Skip all permission prompts (dangerous - use with caution!)
  dangerouslySkipPermissions?: boolean;
}

/**
 * Options for run() method
 */
export interface RunOptions extends Partial<PromptConfig> {
  timeout?: number;
  verbose?: boolean;
}

/**
 * Options for stream() method
 */
export interface StreamOptions extends RunOptions {
  // Buffer size for streaming
  bufferSize?: number;

  // Whether to parse JSON messages (default: false for raw output)
  parse?: boolean;
}

/**
 * Stream chunk from CC
 */
export interface StreamChunk {
  type: 'content' | 'error' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
}

/**
 * Type for interpolation data values
 */
export type InterpolationValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | InterpolationValue[]
  | { [key: string]: InterpolationValue };

/**
 * Type for interpolation data
 */
export type InterpolationData = Record<string, InterpolationValue>;

/**
 * Options for launch() method
 */
export interface LaunchOptions {
  // Process launching mode
  mode?: 'interactive' | 'detached' | 'background';

  // Log file for detached/background modes
  logFile?: string;

  // Environment variables to pass to process
  env?: Record<string, string>;

  // Additional spawn options
  cwd?: string;

  // Shell to use (for shell: true mode)
  shell?: boolean | string;
}

/**
 * Result from launch() method
 */
export interface LaunchResult {
  // Process ID (for detached/background modes)
  pid?: number;

  // Exit code (for interactive mode)
  exitCode?: number;

  // Error message if launch failed
  error?: string;
}

/**
 * Docker configuration options
 */
export interface DockerOptions {
  // Auto-detection mode (default: true)
  auto?: boolean;

  // Docker image to use (overrides auto-detection)
  image?: string;

  // Path to Dockerfile to build (default: ./Dockerfile if exists)
  dockerfile?: string;

  // Additional volume mounts (Docker format: "host:container:mode")
  mounts?: string[];

  // Additional environment variables
  env?: Record<string, string>;
}

/**
 * Resolved Docker configuration after auto-detection
 */
export interface ResolvedDockerConfig {
  // Execution mode
  mode: 'image' | 'dockerfile' | 'auto';

  // Docker image name
  image: string;

  // All volume mounts including auth
  mounts: string[];

  // All environment variables
  env: Record<string, string>;

  // Whether to build image first
  needsBuild?: boolean;

  // Dockerfile path if building
  dockerfilePath?: string;
}
