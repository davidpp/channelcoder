/**
 * Configuration options for worktree operations
 */
export interface WorktreeOptions {
  /** Target branch for the worktree (required for creation) */
  branch?: string;
  /** Base branch for new worktree creation */
  base?: string;
  /** Custom path for worktree (auto-generated if not provided) */
  path?: string;
  /** Whether to remove worktree after execution (default: true for temporary operations) */
  cleanup?: boolean;
  /** Force creation vs. error if exists (default: false - upsert behavior) */
  create?: boolean;
}

/**
 * Information about a worktree
 */
export interface WorktreeInfo {
  /** Branch name */
  branch: string;
  /** Absolute path to worktree directory */
  path: string;
  /** Whether worktree existed before this operation */
  exists: boolean;
  /** Original working directory before switching to worktree */
  originalPath: string;
  /** Current commit hash in the worktree */
  commit?: string;
  /** Whether this worktree was auto-created by the operation */
  autoCreated?: boolean;
}

/**
 * Resolved configuration after processing options
 */
export interface ResolvedWorktreeConfig {
  branch: string;
  path: string;
  base?: string;
  cleanup: boolean;
  create: boolean;
}

/**
 * Custom error for worktree operations
 */
export class WorktreeError extends Error {
  constructor(
    message: string,
    public code:
      | 'BRANCH_NOT_FOUND'
      | 'PATH_CONFLICT'
      | 'GIT_ERROR'
      | 'WORKTREE_EXISTS'
      | 'INVALID_OPTIONS',
    public details?: unknown
  ) {
    super(message);
    this.name = 'WorktreeError';
  }
}
