import simpleGit, { type SimpleGit } from 'simple-git';
import { join, resolve, dirname, basename } from 'node:path';
import { cwd } from 'node:process';
import type { WorktreeOptions, WorktreeInfo, ResolvedWorktreeConfig, WorktreeError } from './types.js';

/**
 * Manages git worktree operations using simple-git
 */
export class WorktreeManager {
  private git: SimpleGit;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || cwd();
    this.git = simpleGit(this.projectRoot);
  }

  /**
   * Ensure a worktree exists for the given branch (upsert behavior)
   */
  async ensureWorktree(branch: string, options: WorktreeOptions = {}): Promise<WorktreeInfo> {
    try {
      // Resolve configuration
      const config = this.resolveConfig(branch, options);
      
      // Check if worktree already exists
      const existing = await this.findExistingWorktree(config.branch);
      if (existing && !config.create) {
        return {
          ...existing,
          originalPath: this.projectRoot
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
          originalPath: this.projectRoot
        };
      }

      // Return existing worktree info
      return {
        ...existing,
        originalPath: this.projectRoot
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
              originalPath: this.projectRoot
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      // If worktree command fails, assume no worktrees exist
      return null;
    }
  }

  /**
   * List all existing worktrees
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const worktrees = await this.git.raw(['worktree', 'list', '--porcelain']);
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
            originalPath: this.projectRoot
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
      return [];
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(path: string, force = false): Promise<void> {
    try {
      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(path);
      
      await this.git.raw(args);
    } catch (error) {
      throw this.createWorktreeError(error, `Failed to remove worktree at ${path}`);
    }
  }

  /**
   * Execute a function within a worktree context
   */
  async executeInWorktree<T>(
    worktreeInfo: WorktreeInfo,
    callback: () => Promise<T>
  ): Promise<T> {
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
  private resolveConfig(branch: string, options: WorktreeOptions): ResolvedWorktreeConfig {
    const path = options.path || this.generateWorktreePath(branch);
    
    return {
      branch,
      path: resolve(path),
      base: options.base,
      cleanup: options.cleanup ?? true,
      create: options.create ?? false
    };
  }

  /**
   * Generate a logical path for a worktree based on branch name
   */
  private generateWorktreePath(branch: string): string {
    // Clean branch name for filesystem
    const safeBranch = branch.replace(/[\/\\:*?"<>|]/g, '-');
    const projectName = basename(this.projectRoot);
    const parentDir = dirname(this.projectRoot);
    
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
      const remoteBranch = remoteBranches.all.find(b => 
        b.includes(`/${branch}`) || b.endsWith(branch)
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
      if (!allBranches.some(b => b.includes(base) || b === base)) {
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
      const args = ['worktree', 'add', config.path];
      
      if (config.base) {
        // Create new branch from base
        args.push('-b', config.branch, config.base);
      } else {
        // Use existing branch
        args.push(config.branch);
      }
      
      await this.git.raw(args);
    } catch (error) {
      throw this.createWorktreeError(error, `Failed to create worktree for branch '${config.branch}'`);
    }
  }

  /**
   * Create a standardized WorktreeError
   */
  private createWorktreeError(originalError: any, message: string): WorktreeError {
    const { WorktreeError } = require('./types.js');
    
    if (originalError instanceof WorktreeError) {
      return originalError;
    }

    let code: any = 'GIT_ERROR';
    const errorMessage = originalError?.message || String(originalError);
    
    if (errorMessage.includes('already exists')) {
      code = 'WORKTREE_EXISTS';
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      code = 'BRANCH_NOT_FOUND';
    } else if (errorMessage.includes('path') && errorMessage.includes('conflict')) {
      code = 'PATH_CONFLICT';
    }

    return new WorktreeError(
      `${message}: ${errorMessage}`,
      code,
      originalError
    );
  }
}