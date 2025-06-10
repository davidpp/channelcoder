import { basename, dirname, join, resolve } from 'node:path';
import { cwd } from 'node:process';
import simpleGit, { type SimpleGit } from 'simple-git';
import { findMainRepository, getMainRepoGit } from './git-utils.js';
import type {
  ResolvedWorktreeConfig,
  WorktreeError,
  WorktreeInfo,
  WorktreeOptions,
} from './types.js';

/**
 * Manages git worktree operations using simple-git
 */
export class WorktreeManager {
  private git: SimpleGit;
  private projectRoot: string;
  private mainRepoRoot?: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || cwd();
    this.git = simpleGit(this.projectRoot);
  }

  /**
   * Get the main repository root (cached)
   */
  private async getMainRepoRoot(): Promise<string> {
    if (!this.mainRepoRoot) {
      this.mainRepoRoot = await findMainRepository(this.projectRoot);
    }
    return this.mainRepoRoot;
  }

  /**
   * Get git instance for the main repository
   */
  private async getMainRepoGit(): Promise<SimpleGit> {
    const mainRoot = await this.getMainRepoRoot();
    return simpleGit(mainRoot);
  }

  /**
   * Ensure a worktree exists for the given branch (upsert behavior)
   */
  async ensureWorktree(branch: string, options: WorktreeOptions = {}): Promise<WorktreeInfo> {
    try {
      // Resolve configuration
      const config = await this.resolveConfig(branch, options);

      // Check if worktree already exists
      const existing = await this.findExistingWorktree(config.branch);
      if (existing && !config.create) {
        return {
          ...existing,
          originalPath: this.projectRoot,
        };
      }

      // Validate branch exists or can be created
      await this.validateBranch(config.branch, config.base);

      // Create worktree if it doesn't exist
      if (!existing) {
        await this.createWorktree(config);

        return {
          branch: config.branch,
          path: config.path,
          exists: false,
          autoCreated: true,
          originalPath: this.projectRoot,
        };
      }

      // Return existing worktree info
      return {
        ...existing,
        originalPath: this.projectRoot,
      };
    } catch (error) {
      throw this.createWorktreeError(error, 'Failed to ensure worktree');
    }
  }

  /**
   * Find existing worktree for a branch
   */
  async findExistingWorktree(branch: string): Promise<WorktreeInfo | null> {
    try {
      const worktrees = await this.git.raw(['worktree', 'list', '--porcelain']);
      const lines = worktrees.split('\n').filter(Boolean);

      let currentPath = '';
      let currentBranch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentPath = line.substring(9);
        } else if (line.startsWith('branch ')) {
          currentBranch = line.substring(7);

          // Check if this is the branch we're looking for
          if (currentBranch === `refs/heads/${branch}` || currentBranch === branch) {
            return {
              branch,
              path: resolve(currentPath),
              exists: true,
              originalPath: this.projectRoot,
            };
          }
        }
      }

      return null;
    } catch (error) {
      // If worktree command fails (e.g., not a git repo), assume no worktrees exist
      if (error instanceof Error && error.message.includes('not a git repository')) {
        return null;
      }
      // For other errors, we should still return null but log for debugging
      console.debug('Worktree list failed:', error);
      return null;
    }
  }

  /**
   * List all existing worktrees
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      // Always list from main repo to get all worktrees
      const mainGit = await this.getMainRepoGit();
      const worktrees = await mainGit.raw(['worktree', 'list', '--porcelain']);
      const lines = worktrees.split('\n').filter(Boolean);

      const result: WorktreeInfo[] = [];
      let currentWorktree: Partial<WorktreeInfo> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          // Start of new worktree entry
          if (currentWorktree.path) {
            result.push(currentWorktree as WorktreeInfo);
          }
          currentWorktree = {
            path: resolve(line.substring(9)),
            exists: true,
            originalPath: this.projectRoot,
          };
        } else if (line.startsWith('branch ')) {
          const branchRef = line.substring(7);
          currentWorktree.branch = branchRef.startsWith('refs/heads/')
            ? branchRef.substring(11)
            : branchRef;
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        }
      }

      // Add the last worktree
      if (currentWorktree.path) {
        result.push(currentWorktree as WorktreeInfo);
      }

      return result;
    } catch (error) {
      // If not a git repository or worktree command fails, return empty array
      if (
        error instanceof Error &&
        (error.message.includes('not a git repository') ||
          error.message.includes('unknown command'))
      ) {
        return [];
      }
      // Log unexpected errors for debugging
      console.debug('Failed to list worktrees:', error);
      return [];
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(path: string, force = false): Promise<void> {
    try {
      // Always remove from main repo
      const mainGit = await this.getMainRepoGit();
      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(path);

      await mainGit.raw(args);
    } catch (error) {
      throw this.createWorktreeError(error, `Failed to remove worktree at ${path}`);
    }
  }

  /**
   * Execute a function within a worktree context
   */
  async executeInWorktree<T>(worktreeInfo: WorktreeInfo, callback: () => Promise<T>): Promise<T> {
    const originalCwd = cwd();

    try {
      process.chdir(worktreeInfo.path);
      return await callback();
    } finally {
      process.chdir(originalCwd);
    }
  }

  /**
   * Resolve configuration options into concrete config
   */
  private async resolveConfig(
    branch: string,
    options: WorktreeOptions
  ): Promise<ResolvedWorktreeConfig> {
    const path = options.path || (await this.generateWorktreePath(branch));

    return {
      branch,
      path: resolve(path),
      base: options.base,
      cleanup: options.cleanup ?? true,
      create: options.create ?? false,
    };
  }

  /**
   * Generate a logical path for a worktree based on branch name
   */
  private async generateWorktreePath(branch: string): Promise<string> {
    // Clean branch name for filesystem
    const safeBranch = branch.replace(/[\/\\:*?"<>|]/g, '-');

    // Use main repo root to ensure siblings
    const mainRoot = await this.getMainRepoRoot();
    const projectName = basename(mainRoot);
    const parentDir = dirname(mainRoot);

    return join(parentDir, `${projectName}-${safeBranch}`);
  }

  /**
   * Validate that a branch exists or can be created
   */
  private async validateBranch(branch: string, base?: string): Promise<void> {
    try {
      // Check if branch exists locally
      const branches = await this.git.branchLocal();
      if (branches.all.includes(branch)) {
        return;
      }

      // Check if branch exists remotely
      const remoteBranches = await this.git.branch(['-r']);
      const remoteBranch = remoteBranches.all.find(
        (b) => b.includes(`/${branch}`) || b.endsWith(branch)
      );

      if (remoteBranch) {
        // Branch exists remotely, we can track it
        return;
      }

      // If no base branch provided and branch doesn't exist, error
      if (!base) {
        throw new Error(`Branch '${branch}' does not exist and no base branch specified`);
      }

      // Validate base branch exists
      const allBranches = [...branches.all, ...remoteBranches.all];
      if (!allBranches.some((b) => b.includes(base) || b === base)) {
        throw new Error(`Base branch '${base}' does not exist`);
      }
    } catch (error) {
      throw this.createWorktreeError(error, 'Branch validation failed');
    }
  }

  /**
   * Create a new worktree
   */
  private async createWorktree(config: ResolvedWorktreeConfig): Promise<void> {
    try {
      // Always create from main repo to ensure correct placement
      const mainGit = await this.getMainRepoGit();
      const args = ['worktree', 'add', config.path];

      if (config.base) {
        // Create new branch from base
        args.push('-b', config.branch, config.base);
      } else {
        // Use existing branch
        args.push(config.branch);
      }

      await mainGit.raw(args);
    } catch (error) {
      throw this.createWorktreeError(
        error,
        `Failed to create worktree for branch '${config.branch}'`
      );
    }
  }

  /**
   * Create a standardized WorktreeError
   */
  private createWorktreeError(originalError: unknown, message: string): WorktreeError {
    const { WorktreeError } = require('./types.js');

    if (originalError instanceof WorktreeError) {
      return originalError as WorktreeError;
    }

    let code:
      | 'BRANCH_NOT_FOUND'
      | 'PATH_CONFLICT'
      | 'GIT_ERROR'
      | 'WORKTREE_EXISTS'
      | 'INVALID_OPTIONS' = 'GIT_ERROR';
    const errorMessage =
      originalError instanceof Error ? originalError.message : String(originalError);

    if (errorMessage.includes('already exists')) {
      code = 'WORKTREE_EXISTS';
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      code = 'BRANCH_NOT_FOUND';
    } else if (errorMessage.includes('path') && errorMessage.includes('conflict')) {
      code = 'PATH_CONFLICT';
    }

    return new WorktreeError(`${message}: ${errorMessage}`, code, originalError);
  }
}
