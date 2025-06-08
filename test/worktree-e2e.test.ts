import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import { claude, worktree } from '../src/index.js';
import { worktreeUtils } from '../src/worktree/index.js';
import { WorktreeError } from '../src/worktree/types.js';

describe('Worktree E2E Tests', () => {
  const testRepoPath = join(process.cwd(), '.test-repo');
  const git = simpleGit();

  beforeAll(async () => {
    // Clean up any leftover worktrees from previous runs
    const worktreePath = join(process.cwd(), '.test-repo-feature-test-branch');
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }

    // Create a test git repository
    if (existsSync(testRepoPath)) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
    mkdirSync(testRepoPath);

    const testGit = simpleGit(testRepoPath);
    await testGit.init();
    await testGit.addConfig('user.name', 'Test User');
    await testGit.addConfig('user.email', 'test@example.com');

    // Create initial commit
    const testFile = join(testRepoPath, 'README.md');
    await Bun.write(testFile, '# Test Repository');
    await testGit.add('.');
    await testGit.commit('Initial commit');

    // Create a test branch
    await testGit.checkoutLocalBranch('feature/test-branch');
    await testGit.checkout('main');
  });

  afterAll(async () => {
    // Cleanup test repository
    if (existsSync(testRepoPath)) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }

    // Clean up any worktrees
    const worktreePath = join(process.cwd(), '.test-repo-feature-test-branch');
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  it('should execute claude in a worktree with dry-run', async () => {
    // Change to test repo for this test
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      const result = await claude('Analyze the project structure', {
        worktree: 'feature/test-branch',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.fullCommand).toContain('claude');

      // Verify we're back in the original directory
      expect(process.cwd()).toBe(testRepoPath);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should create and use a worktree with standalone function', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      let worktreePath: string | undefined;

      const result = await worktree(
        'feature/test-branch',
        async (wt) => {
          expect(wt.branch).toBe('feature/test-branch');
          expect(wt.path).toContain('test-repo-feature-test-branch');
          expect(existsSync(wt.path)).toBe(true);

          worktreePath = wt.path;

          // Verify we're in the worktree directory
          expect(process.cwd()).toBe(wt.path);

          return 'test-complete';
        },
        {
          cleanup: false, // Keep it so we can verify it exists
        }
      );

      expect(result).toBe('test-complete');

      // Verify we're back in the test repo
      expect(process.cwd()).toBe(testRepoPath);

      // Verify worktree still exists
      if (worktreePath) {
        expect(existsSync(worktreePath)).toBe(true);

        // Cleanup manually
        await worktreeUtils.remove('feature/test-branch');
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should list and find worktrees', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      // Create a worktree
      await worktreeUtils.create('feature/test-branch');

      // List worktrees
      const worktrees = await worktreeUtils.list();
      expect(worktrees.length).toBeGreaterThan(0);

      // Find specific worktree
      const found = await worktreeUtils.find('feature/test-branch');
      expect(found).toBeTruthy();
      expect(found?.branch).toBe('feature/test-branch');

      // Check existence
      const exists = await worktreeUtils.exists('feature/test-branch');
      expect(exists).toBe(true);

      // Cleanup
      await worktreeUtils.remove('feature/test-branch');

      // Verify it's gone
      const existsAfter = await worktreeUtils.exists('feature/test-branch');
      expect(existsAfter).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should handle worktree creation with base branch', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      const result = await worktree(
        'feature/new-feature',
        async (wt) => {
          expect(wt.branch).toBe('feature/new-feature');
          expect(wt.autoCreated).toBe(true);

          // Verify the branch was created
          const testGit = simpleGit(wt.path);
          const branches = await testGit.branchLocal();
          expect(branches.current).toBe('feature/new-feature');

          return 'created';
        },
        {
          base: 'main',
          cleanup: true,
        }
      );

      expect(result).toBe('created');

      // Verify worktree was cleaned up
      const exists = await worktreeUtils.exists('feature/new-feature');
      expect(exists).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should handle errors gracefully', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      // Try to create worktree for non-existent branch without base
      await expect(worktreeUtils.create('non-existent-branch')).rejects.toThrow(WorktreeError);

      // Try to create worktree with invalid base
      await expect(
        worktreeUtils.create('feature/bad', { base: 'non-existent-base' })
      ).rejects.toThrow(WorktreeError);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should compose worktree with other options in dry-run mode', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      await worktree(
        'feature/test-branch',
        async (wt) => {
          // Test that worktree works with other options (skip docker since it needs config)
          const result = await claude('Test with multiple options', {
            tools: ['Read', 'Write'],
            maxTurns: 5,
            dryRun: true,
          });

          expect(result.success).toBe(true);
          expect(result.data?.fullCommand).toBeTruthy();
          expect(result.data?.fullCommand).toContain('claude');
          expect(result.data?.fullCommand).toContain('--allowedTools');
          expect(result.data?.fullCommand).toContain('Read,Write');

          return 'options-test';
        },
        {
          cleanup: true,
        }
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should handle current worktree detection', async () => {
    const originalCwd = process.cwd();
    process.chdir(testRepoPath);

    try {
      // Create a worktree and verify detection
      await worktree(
        'feature/new-detection',
        async (wt) => {
          // Inside the worktree callback, we should be in the worktree directory
          expect(process.cwd()).toBe(wt.path);

          // The path should exist
          expect(existsSync(wt.path)).toBe(true);

          // We can at least verify the worktree info is correct
          expect(wt.branch).toBe('feature/new-detection');
          expect(wt.autoCreated).toBe(true);
        },
        {
          base: 'main', // Create new branch for this test
          cleanup: true,
        }
      );

      // After worktree execution, we should be back in test repo
      expect(process.cwd()).toBe(testRepoPath);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
