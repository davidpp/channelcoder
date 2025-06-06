/**
 * Worktree module exports
 * 
 * Provides git worktree management functionality with multiple levels of abstraction:
 * - High-level: worktree() function for callback-based usage
 * - Building blocks: worktreeUtils.* for advanced users
 * - Types: All TypeScript interfaces and types
 */

// Main worktree function (high-level utility)
export { worktree } from './worktree.js';

// Utility functions (building blocks for advanced users)
export { worktreeUtils } from './utils.js';

// Core manager class (for very advanced usage)
export { WorktreeManager } from './manager.js';

// All types
export type {
  WorktreeOptions,
  WorktreeInfo,
  ResolvedWorktreeConfig
} from './types.js';

// Error class
export { WorktreeError } from './types.js';