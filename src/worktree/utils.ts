import { WorktreeManager } from './manager.js';
import type { WorktreeOptions, WorktreeInfo } from './types.js';

/**
 * Utility functions for worktree management
 * 
 * These functions provide building blocks for advanced users who want
 * fine-grained control over worktree operations. They follow the same
 * pattern as streamParser.* utilities.
 */
export const worktreeUtils = {
  /**
   * Create a new worktree
   * 
   * @param branch - Branch name for the worktree
   * @param options - Worktree configuration options
   * @returns Information about the created worktree
   * 
   * @example
   * ```typescript
   * const wt = await worktreeUtils.create('feature/payments');
   * console.log('Created worktree at:', wt.path);
   * ```
   */
  async create(branch: string, options: Omit<WorktreeOptions, 'branch'> = {}): Promise<WorktreeInfo> {
    const manager = new WorktreeManager();
    return manager.ensureWorktree(branch, { ...options, create: true });
  },

  /**
   * List all existing worktrees
   * 
   * @returns Array of all existing worktrees
   * 
   * @example
   * ```typescript
   * const worktrees = await worktreeUtils.list();
   * for (const wt of worktrees) {
   *   console.log(`${wt.branch} -> ${wt.path}`);
   * }
   * ```
   */
  async list(): Promise<WorktreeInfo[]> {
    const manager = new WorktreeManager();
    return manager.listWorktrees();
  },

  /**
   * Remove a worktree
   * 
   * @param pathOrBranch - Either the path to the worktree or the branch name
   * @param force - Force removal even if worktree has uncommitted changes
   * 
   * @example
   * ```typescript
   * // Remove by branch name
   * await worktreeUtils.remove('feature/old-feature');
   * 
   * // Remove by path
   * await worktreeUtils.remove('/path/to/worktree');
   * 
   * // Force removal
   * await worktreeUtils.remove('feature/broken', true);
   * ```
   */
  async remove(pathOrBranch: string, force = false): Promise<void> {
    const manager = new WorktreeManager();
    
    // Handle both path and branch inputs
    const worktrees = await manager.listWorktrees();
    const target = worktrees.find(wt => 
      wt.path === pathOrBranch || wt.branch === pathOrBranch
    );
    
    if (target) {
      await manager.removeWorktree(target.path, force);
    } else {
      // Assume it's a path if not found in worktree list
      await manager.removeWorktree(pathOrBranch, force);
    }
  },

  /**
   * Check if a worktree exists for a branch
   * 
   * @param branch - Branch name to check
   * @returns True if worktree exists, false otherwise
   * 
   * @example
   * ```typescript
   * if (await worktreeUtils.exists('feature/auth')) {
   *   console.log('Auth feature worktree already exists');
   * }
   * ```
   */
  async exists(branch: string): Promise<boolean> {
    const manager = new WorktreeManager();
    const existing = await manager.findExistingWorktree(branch);
    return existing !== null;
  },

  /**
   * Get current worktree info (if in a worktree)
   * 
   * @returns Current worktree info or null if not in a worktree
   * 
   * @example
   * ```typescript
   * const current = await worktreeUtils.current();
   * if (current) {
   *   console.log(`Currently in worktree: ${current.branch}`);
   * } else {
   *   console.log('Not in a worktree');
   * }
   * ```
   */
  async current(): Promise<WorktreeInfo | null> {
    const manager = new WorktreeManager();
    const worktrees = await manager.listWorktrees();
    const cwd = process.cwd();
    
    return worktrees.find(wt => cwd.startsWith(wt.path)) || null;
  },

  /**
   * Find a worktree by branch name
   * 
   * @param branch - Branch name to find
   * @returns Worktree info or null if not found
   * 
   * @example
   * ```typescript
   * const authWorktree = await worktreeUtils.find('feature/auth');
   * if (authWorktree) {
   *   console.log('Auth worktree is at:', authWorktree.path);
   * }
   * ```
   */
  async find(branch: string): Promise<WorktreeInfo | null> {
    const manager = new WorktreeManager();
    return manager.findExistingWorktree(branch);
  },

  /**
   * Cleanup all auto-created worktrees
   * 
   * This is useful for cleaning up temporary worktrees that may have been
   * left behind due to interrupted operations.
   * 
   * @param dryRun - If true, only list what would be cleaned up
   * @returns Array of paths that were (or would be) cleaned up
   * 
   * @example
   * ```typescript
   * // See what would be cleaned up
   * const toCleanup = await worktreeUtils.cleanup(true);
   * console.log('Would cleanup:', toCleanup);
   * 
   * // Actually cleanup
   * await worktreeUtils.cleanup();
   * ```
   */
  async cleanup(dryRun = false): Promise<string[]> {
    const manager = new WorktreeManager();
    const worktrees = await manager.listWorktrees();
    const toRemove: string[] = [];
    
    for (const wt of worktrees) {
      // Heuristic: if the worktree path matches our auto-generated pattern
      // and the directory name contains the project name + branch pattern
      const pathParts = wt.path.split('/');
      const dirname = pathParts[pathParts.length - 1];
      
      if (dirname.includes('-') && (dirname.startsWith('channelcoder-') || 
          dirname.includes('-feature-') || dirname.includes('-hotfix-') ||
          dirname.includes('-experiment-'))) {
        toRemove.push(wt.path);
        
        if (!dryRun) {
          try {
            await manager.removeWorktree(wt.path);
          } catch (error) {
            console.warn(`Warning: Failed to cleanup worktree at ${wt.path}:`, error);
          }
        }
      }
    }
    
    return toRemove;
  }
};