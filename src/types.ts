import { z } from 'zod';

/**
 * Result from CC (Claude Code) execution
 */
export interface CCResult {
  success: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
  warnings?: string[];
}

/**
 * Configuration for prompts (from frontmatter or programmatic)
 */
export interface PromptConfig {
  // Input schema for validation
  input?: z.ZodSchema | Record<string, z.ZodType>;
  
  // Output schema for parsing
  output?: z.ZodSchema;
  
  // System prompt (inline string or file path)
  systemPrompt?: string;
  
  // Claude CLI options
  allowedTools?: string[];
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
}

/**
 * Stream chunk from CC
 */
export interface StreamChunk {
  type: 'content' | 'error' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
}