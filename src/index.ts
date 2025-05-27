/**
 * ChannelCoder SDK - Channel your prompts to Claude Code
 *
 * Function-based SDK for interacting with Claude Code CLI
 */

// Export main functions
export { claude, interactive, stream, run, type ClaudeOptions } from './functions.js';

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
