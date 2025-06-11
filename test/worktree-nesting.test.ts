import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import simpleGit from 'simple-git';
import { worktreeUtils } from '../src/index.js';

describe('Worktree nesting prevention', () => {
  const testRepoPath = join(process.cwd(), '.test-nesting-repo');
  let worktreeAPath: string;
  let worktreeBPath: string;
  let expectedWorktreeBPath: string;

  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testRepoPath)) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }

    // Create test repo
    mkdirSync(testRepoPath);
    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial commit
    await Bun.write(join(testRepoPath, 'README.md'), '# Test Repo');
    await git.add('.');
    await git.commit('Initial commit');

    // Create test branches
    await git.checkoutLocalBranch('branch-a');
    await git.checkout('main');
    await git.checkoutLocalBranch('branch-b');
    await git.checkout('main');

    // Set expected paths
    const projectName = basename(testRepoPath);
    const parentDir = dirname(testRepoPath);
    worktreeAPath = join(parentDir, `${projectName}-branch-a`);
    worktreeBPath = join(parentDir, `${projectName}-branch-b`);
    expectedWorktreeBPath = worktreeBPath; // Should be sibling
  });

  afterAll(async () => {
    // Cleanup
    const pathsToClean = [testRepoPath, worktreeAPath, worktreeBPath];
    
    // Also clean any potential nested worktrees
    const nestedPath = join(worktreeAPath, '.test-nesting-repo-branch-b');
    if (existsSync(nestedPath)) {
      pathsToClean.push(nestedPath);
    }

    for (const path of pathsToClean) {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  });

  test('creates sibling worktrees when run from main repo', async () => {
    const wtA = await worktreeUtils.create('branch-a', { cwd: testRepoPath });
    expect(wtA.path).toBe(worktreeAPath);
    expect(existsSync(wtA.path)).toBe(true);

    const wtB = await worktreeUtils.create('branch-b', { cwd: testRepoPath });
    expect(wtB.path).toBe(worktreeBPath);
    expect(existsSync(wtB.path)).toBe(true);

    // Verify they are siblings
    expect(dirname(wtA.path)).toBe(dirname(wtB.path));
  });

  test('creates sibling worktrees when run from within a worktree', async () => {
    // First create worktree A
    const wtA = await worktreeUtils.create('branch-a', { cwd: testRepoPath });
    expect(existsSync(wtA.path)).toBe(true);

    // Now create worktree B from within worktree A
    const wtB = await worktreeUtils.create('branch-b', { cwd: wtA.path });
    
    // Should be a sibling, not nested
    expect(wtB.path).toBe(expectedWorktreeBPath);
    expect(wtB.path).not.toContain(wtA.path);
    expect(dirname(wtB.path)).toBe(dirname(wtA.path));
    
    // Verify it was NOT created as a nested worktree
    const nestedPath = join(wtA.path, '.test-nesting-repo-branch-b');
    expect(existsSync(nestedPath)).toBe(false);
  });

  test('lists all worktrees from any location', async () => {
    // Create worktrees
    await worktreeUtils.create('branch-a', { cwd: testRepoPath });
    const wtB = await worktreeUtils.create('branch-b', { cwd: testRepoPath });

    // List from main repo
    const fromMain = await worktreeUtils.list({ cwd: testRepoPath });
    const branches = fromMain.map(wt => wt.branch).sort();
    expect(branches).toContain('branch-a');
    expect(branches).toContain('branch-b');

    // List from worktree A
    const fromWorktreeA = await worktreeUtils.list({ cwd: worktreeAPath });
    const branchesFromA = fromWorktreeA.map(wt => wt.branch).sort();
    expect(branchesFromA).toEqual(branches);

    // List from worktree B
    const fromWorktreeB = await worktreeUtils.list({ cwd: wtB.path });
    const branchesFromB = fromWorktreeB.map(wt => wt.branch).sort();
    expect(branchesFromB).toEqual(branches);
  });

  test('detects if in a worktree correctly', async () => {
    // Test from main repo
    const inMainRepo = await worktreeUtils.isInWorktree(testRepoPath);
    expect(inMainRepo).toBe(false);

    // Create a worktree
    const wt = await worktreeUtils.create('branch-a', { cwd: testRepoPath });

    // Test from worktree
    const inWorktree = await worktreeUtils.isInWorktree(wt.path);
    expect(inWorktree).toBe(true);
  });

  test('finds main repository from any location', async () => {
    // From main repo
    const fromMain = await worktreeUtils.findMainRepository(testRepoPath);
    expect(fromMain).toBe(testRepoPath);

    // Create a worktree
    const wt = await worktreeUtils.create('branch-a', { cwd: testRepoPath });

    // From worktree
    const fromWorktree = await worktreeUtils.findMainRepository(wt.path);
    expect(fromWorktree).toBe(testRepoPath);
  });
});