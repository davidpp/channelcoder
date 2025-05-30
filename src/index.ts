/**
 * ChannelCoder SDK - Channel your prompts to Claude Code
 *
 * Function-based SDK for interacting with Claude Code CLI
 */

// Export main functions
export { claude, interactive, stream, run, detached, type ClaudeOptions } from './functions.js';

// Export session management
export { session } from './session.js';
export type { Session, SessionOptions, SessionInfo, Message, SessionState } from './session.js';
export type { SessionStorage } from './session.js';
export { FileSessionStorage } from './session-storage.js';

// Export types
export type {
  CCResult,
  StreamChunk,
  LaunchResult,
  InterpolationData,
  InterpolationValue,
} from './types.js';

// Export loader utilities for advanced usage
export { loadPromptFile, FrontmatterSchema, type Frontmatter } from './loader.js';

// Export stream parser utilities
export * as streamParser from './stream-parser/index.js';

// High-level stream parser exports for common use cases
export { parseLogFile, monitorLog } from './stream-parser/index.js';

// Re-export stream parser types for convenience
export type {
  ClaudeEvent,
  SystemEvent,
  AssistantEvent,
  ResultEvent,
  ToolUseEvent,
  ToolResultEvent,
  ErrorEvent,
  ParsedLog,
} from './stream-parser/types.js';

// Re-export type guards for convenience
export {
  isSystemEvent,
  isAssistantEvent,
  isResultEvent,
  isToolUseEvent,
  isToolResultEvent,
  isErrorEvent,
} from './stream-parser/types.js';
