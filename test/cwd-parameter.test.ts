import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import { claude, worktreeUtils } from '../src/index.js';

// Access the nested worktreeUtils
const utils = worktreeUtils.worktreeUtils;

describe('CWD parameter support', () => {
  const baseTestPath = join(process.cwd(), '.test-cwd');
  const repo1Path = join(baseTestPath, 'repo1');
  const repo2Path = join(baseTestPath, 'repo2');
  let worktree1Path: string;
  let worktree2Path: string;

  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(baseTestPath)) {
      rmSync(baseTestPath, { recursive: true, force: true });
    }

    // Create base directory
    mkdirSync(baseTestPath, { recursive: true });

    // Create first test repo
    mkdirSync(repo1Path);
    const git1 = simpleGit(repo1Path);
    await git1.init();
    await git1.addConfig('user.name', 'Test User');
    await git1.addConfig('user.email', 'test@example.com');
    await Bun.write(join(repo1Path, 'README.md'), '# Repo 1');
    await git1.add('.');
    await git1.commit('Initial commit');
    await git1.checkoutLocalBranch('feature-1');
    await git1.checkout('main');

    // Create second test repo
    mkdirSync(repo2Path);
    const git2 = simpleGit(repo2Path);
    await git2.init();
    await git2.addConfig('user.name', 'Test User');
    await git2.addConfig('user.email', 'test@example.com');
    await Bun.write(join(repo2Path, 'README.md'), '# Repo 2');
    await git2.add('.');
    await git2.commit('Initial commit');
    await git2.checkoutLocalBranch('feature-2');
    await git2.checkout('main');

    // Set expected worktree paths
    worktree1Path = join(baseTestPath, 'repo1-feature-1');
    worktree2Path = join(baseTestPath, 'repo2-feature-2');
  });

  afterAll(async () => {
    // Cleanup all test directories
    if (existsSync(baseTestPath)) {
      rmSync(baseTestPath, { recursive: true, force: true });
    }
  });

  test('worktreeUtils functions work with different cwd values', async () => {
    // Create worktree in repo1
    const wt1 = await utils.create('feature-1', { cwd: repo1Path });
    expect(wt1.path).toBe(worktree1Path);
    expect(existsSync(wt1.path)).toBe(true);

    // Create worktree in repo2
    const wt2 = await utils.create('feature-2', { cwd: repo2Path });
    expect(wt2.path).toBe(worktree2Path);
    expect(existsSync(wt2.path)).toBe(true);

    // List worktrees from repo1
    const list1 = await utils.list({ cwd: repo1Path });
    const branches1 = list1.map(wt => wt.branch);
    expect(branches1).toContain('feature-1');
    expect(branches1).not.toContain('feature-2');

    // List worktrees from repo2
    const list2 = await utils.list({ cwd: repo2Path });
    const branches2 = list2.map(wt => wt.branch);
    expect(branches2).toContain('feature-2');
    expect(branches2).not.toContain('feature-1');

    // Check existence in correct repos
    expect(await utils.exists('feature-1', { cwd: repo1Path })).toBe(true);
    expect(await utils.exists('feature-1', { cwd: repo2Path })).toBe(false);
    expect(await utils.exists('feature-2', { cwd: repo1Path })).toBe(false);
    expect(await utils.exists('feature-2', { cwd: repo2Path })).toBe(true);

    // Find worktrees in correct repos
    const found1 = await utils.find('feature-1', { cwd: repo1Path });
    expect(found1).not.toBeNull();
    expect(found1?.path).toBe(worktree1Path);

    const notFound1 = await utils.find('feature-1', { cwd: repo2Path });
    expect(notFound1).toBeNull();

    // Remove worktrees with cwd
    await utils.remove('feature-1', { cwd: repo1Path });
    expect(existsSync(worktree1Path)).toBe(false);

    await utils.remove('feature-2', { cwd: repo2Path });
    expect(existsSync(worktree2Path)).toBe(false);
  });

  test('claude() function respects cwd parameter with worktree', async () => {
    // Test dry-run mode to verify command construction
    const result1 = await claude('test prompt', {
      worktree: 'feature-1',
      cwd: repo1Path,
      dryRun: true,
    });

    expect(result1.success).toBe(true);
    expect(result1.data).toBeDefined();
    
    // Verify the command would execute in the correct worktree
    const command1 = result1.data as any;
    expect(command1.fullCommand).toContain('claude');
    
    // Test with second repo
    const result2 = await claude('test prompt', {
      worktree: 'feature-2',
      cwd: repo2Path,
      dryRun: true,
    });

    expect(result2.success).toBe(true);
    expect(result2.data).toBeDefined();
  });

  test('worktree detection utilities work with cwd', async () => {
    // Test isInWorktree
    const inMainRepo1 = await utils.isInWorktree(repo1Path);
    expect(inMainRepo1).toBe(false);

    const inMainRepo2 = await utils.isInWorktree(repo2Path);
    expect(inMainRepo2).toBe(false);

    // Create worktrees to test detection
    const wt1 = await utils.create('feature-1', { cwd: repo1Path });
    const wt2 = await utils.create('feature-2', { cwd: repo2Path });

    const inWorktree1 = await utils.isInWorktree(wt1.path);
    expect(inWorktree1).toBe(true);

    const inWorktree2 = await utils.isInWorktree(wt2.path);
    expect(inWorktree2).toBe(true);

    // Test findMainRepository
    const mainFromRepo1 = await utils.findMainRepository(repo1Path);
    expect(mainFromRepo1).toBe(repo1Path);

    const mainFromRepo2 = await utils.findMainRepository(repo2Path);
    expect(mainFromRepo2).toBe(repo2Path);

    const mainFromWorktree1 = await utils.findMainRepository(wt1.path);
    expect(mainFromWorktree1).toBe(repo1Path);

    const mainFromWorktree2 = await utils.findMainRepository(wt2.path);
    expect(mainFromWorktree2).toBe(repo2Path);
  });

  test('current() function works with cwd parameter', async () => {
    // Create worktrees
    const wt1 = await utils.create('feature-1', { cwd: repo1Path });
    const wt2 = await utils.create('feature-2', { cwd: repo2Path });

    // Test current from main repos
    const currentFromMain1 = await utils.current({ cwd: repo1Path });
    expect(currentFromMain1).not.toBeNull();
    expect(currentFromMain1?.branch).toBe('main');
    expect(currentFromMain1?.path).toBe(repo1Path);

    const currentFromMain2 = await utils.current({ cwd: repo2Path });
    expect(currentFromMain2).not.toBeNull();
    expect(currentFromMain2?.branch).toBe('main');
    expect(currentFromMain2?.path).toBe(repo2Path);

    // Test current from worktrees
    const currentFromWt1 = await utils.current({ cwd: wt1.path });
    expect(currentFromWt1).not.toBeNull();
    expect(currentFromWt1?.branch).toBe('feature-1');

    const currentFromWt2 = await utils.current({ cwd: wt2.path });
    expect(currentFromWt2).not.toBeNull();
    expect(currentFromWt2?.branch).toBe('feature-2');
  });

  test('cleanup() function works with cwd parameter', async () => {
    // Create auto-pattern worktrees in both repos
    await utils.create('feature-test', { cwd: repo1Path, base: 'main' });
    await utils.create('experiment-test', { cwd: repo2Path, base: 'main' });

    // Test cleanup dry run for repo1
    const toCleanup1 = await utils.cleanup({ dryRun: true, cwd: repo1Path });
    expect(toCleanup1.length).toBeGreaterThan(0);
    expect(toCleanup1.some(path => path.includes('repo1'))).toBe(true);
    expect(toCleanup1.some(path => path.includes('repo2'))).toBe(false);

    // Test cleanup dry run for repo2
    const toCleanup2 = await utils.cleanup({ dryRun: true, cwd: repo2Path });
    expect(toCleanup2.length).toBeGreaterThan(0);
    expect(toCleanup2.some(path => path.includes('repo2'))).toBe(true);
    expect(toCleanup2.some(path => path.includes('repo1'))).toBe(false);

    // Actually cleanup repo1
    const cleaned1 = await utils.cleanup({ cwd: repo1Path });
    expect(cleaned1.length).toBeGreaterThan(0);

    // Verify repo2 worktrees still exist
    const list2After = await utils.list({ cwd: repo2Path });
    expect(list2After.length).toBeGreaterThan(0);
  });
});