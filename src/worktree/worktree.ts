import { WorktreeManager } from './manager.js';
import type { WorktreeOptions, WorktreeInfo } from './types.js';

/**
 * Execute a callback within a git worktree context
 * 
 * This is the main user-facing function for worktree operations.
 * It follows the same pattern as other ChannelCoder utilities like parseLogFile().
 * 
 * @param branch - Branch name for the worktree
 * @param callback - Function to execute in worktree context
 * @param options - Worktree configuration options
 * @returns Result of the callback function
 * 
 * @example
 * ```typescript
 * // Basic usage
 * await worktree('feature/auth', async (wt) => {
 *   console.log('Working in:', wt.path);
 *   return await claude('Implement OAuth');
 * });
 * 
 * // With configuration
 * await worktree('experiment/risky', async (wt) => {
 *   return await claude('Test changes', { docker: true });
 * }, {
 *   base: 'main',
 *   cleanup: false // Keep worktree after execution
 * });
 * ```
 */
export async function worktree<T>(
  branch: string,
  callback: (info: WorktreeInfo) => Promise<T>,
  options: WorktreeOptions = {}
): Promise<T> {
  const manager = new WorktreeManager();
  
  // Ensure worktree exists (upsert behavior)
  const worktreeInfo = await manager.ensureWorktree(branch, options);
  
  try {
    // Execute callback within worktree context
    return await manager.executeInWorktree(worktreeInfo, async () => {
      return callback(worktreeInfo);
    });
  } finally {
    // Handle cleanup if requested
    if (options.cleanup !== false && worktreeInfo.autoCreated) {
      try {
        await manager.removeWorktree(worktreeInfo.path);
      } catch (error) {
        // Don't fail the operation if cleanup fails
        console.warn(`Warning: Failed to cleanup worktree at ${worktreeInfo.path}:`, error);
      }
    }
  }
}