import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { claude, session, worktreeUtils } from '../src/index.js';

/**
 * E2E tests for worktree and CWD execution behavior.
 * 
 * These tests verify that when a worktree is specified, Claude executes
 * INSIDE the worktree directory, not in the main repository.
 * 
 * To run these tests with real Claude CLI:
 * ```bash
 * CLAUDE_E2E_TEST=true bun test worktree-execution-e2e.test.ts
 * ```
 */
describe.skipIf(!process.env.CLAUDE_E2E_TEST)('Worktree Execution E2E', () => {
  // Run tests in isolated /tmp directory
  const testBaseDir = `/tmp/channelcoder-e2e-test-${Date.now()}`;
  const testRepoDir = path.join(testBaseDir, 'test-repo');
  
  beforeAll(async () => {
    // Create test directory and git repo
    await fs.mkdir(testRepoDir, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testRepoDir });
    execSync('git config user.email "test@example.com"', { cwd: testRepoDir });
    execSync('git config user.name "Test User"', { cwd: testRepoDir });
    
    // Create initial commit
    await fs.writeFile(path.join(testRepoDir, 'README.md'), '# Test Repository\n');
    execSync('git add . && git commit -m "Initial commit"', { cwd: testRepoDir });
  });
  
  afterAll(async () => {
    // Clean up entire test directory
    await fs.rm(testBaseDir, { recursive: true, force: true });
  });
  
  test('claude() respects cwd parameter', async () => {
    const result = await claude(
      'pwd > cwd-test.txt',
      {
        tools: ['Bash'],
        cwd: testRepoDir
      }
    );
    
    expect(result.success).toBe(true);
    
    // File should be created in test repo
    const testFile = path.join(testRepoDir, 'cwd-test.txt');
    await expect(fs.access(testFile)).resolves.toBeUndefined();
    
    // Verify pwd output matches test repo
    const content = await fs.readFile(testFile, 'utf-8');
    const normalizedRepo = await fs.realpath(testRepoDir);
    expect(content.trim()).toBe(normalizedRepo);
    
    // File should NOT be in channelcoder main repo
    const wrongFile = path.join(process.cwd(), 'cwd-test.txt');
    await expect(fs.access(wrongFile)).rejects.toThrow();
  });
  
  test('claude() executes inside worktree directory', async () => {
    const result = await claude(
      'pwd > worktree-test.txt',
      {
        worktree: { branch: 'test-execution', base: 'main' },
        tools: ['Bash'],
        cwd: testRepoDir
      }
    );
    
    expect(result.success).toBe(true);
    
    // Find the worktree
    const worktrees = await worktreeUtils.list({ cwd: testRepoDir });
    const wt = worktrees.find(w => w.branch === 'test-execution');
    expect(wt).toBeDefined();
    
    if (wt) {
      // File should be in worktree
      const worktreeFile = path.join(wt.path, 'worktree-test.txt');
      await expect(fs.access(worktreeFile)).resolves.toBeUndefined();
      
      // Verify pwd output matches worktree path
      const content = await fs.readFile(worktreeFile, 'utf-8');
      const normalizedWT = await fs.realpath(wt.path);
      expect(content.trim()).toBe(normalizedWT);
      
      // File should NOT be in main test repo
      const mainFile = path.join(testRepoDir, 'worktree-test.txt');
      await expect(fs.access(mainFile)).rejects.toThrow();
      
      // File should NOT be in channelcoder repo
      const wrongFile = path.join(process.cwd(), 'worktree-test.txt');
      await expect(fs.access(wrongFile)).rejects.toThrow();
    }
  });
  
  test('session() executes inside worktree directory', async () => {
    const sessionObj = session({ cwd: testRepoDir });
    const result = await sessionObj.claude(
      'pwd > session-test.txt',
      {
        worktree: { branch: 'test-session', base: 'main' },
        tools: ['Bash']
      }
    );
    
    expect(result.success).toBe(true);
    
    // Find the worktree
    const worktrees = await worktreeUtils.list({ cwd: testRepoDir });
    const wt = worktrees.find(w => w.branch === 'test-session');
    expect(wt).toBeDefined();
    
    if (wt) {
      // File should be in worktree
      const worktreeFile = path.join(wt.path, 'session-test.txt');
      await expect(fs.access(worktreeFile)).resolves.toBeUndefined();
      
      // Verify pwd output
      const content = await fs.readFile(worktreeFile, 'utf-8');
      const normalizedWT = await fs.realpath(wt.path);
      expect(content.trim()).toBe(normalizedWT);
      
      // File should NOT be in main test repo
      const mainFile = path.join(testRepoDir, 'session-test.txt');
      await expect(fs.access(mainFile)).rejects.toThrow();
    }
  });
  
  test('worktree nesting prevention works correctly', async () => {
    // Create first worktree
    const result1 = await claude('echo "parent"', {
      worktree: { branch: 'parent-wt', base: 'main' },
      tools: ['Bash'],
      cwd: testRepoDir
    });
    expect(result1.success).toBe(true);
    
    const worktrees = await worktreeUtils.list({ cwd: testRepoDir });
    const parentWT = worktrees.find(w => w.branch === 'parent-wt');
    expect(parentWT).toBeDefined();
    
    if (parentWT) {
      // Try to create another worktree from inside the first one
      const result2 = await claude('pwd > nested-test.txt', {
        worktree: { branch: 'nested-wt', base: 'main' },
        tools: ['Bash'],
        cwd: parentWT.path  // Execute from inside parent worktree
      });
      
      expect(result2.success).toBe(true);
      
      // Find the "nested" worktree
      const allWorktrees = await worktreeUtils.list({ cwd: testRepoDir });
      const nestedWT = allWorktrees.find(w => w.branch === 'nested-wt');
      expect(nestedWT).toBeDefined();
      
      if (nestedWT) {
        // Both worktrees should be siblings
        const parentDir = path.dirname(await fs.realpath(parentWT.path));
        const nestedDir = path.dirname(await fs.realpath(nestedWT.path));
        expect(nestedDir).toBe(parentDir);
        
        // Nested worktree should NOT be inside parent worktree
        expect(nestedWT.path.startsWith(parentWT.path)).toBe(false);
        
        // Verify Claude executed in the nested worktree
        const pwdFile = path.join(nestedWT.path, 'nested-test.txt');
        const content = await fs.readFile(pwdFile, 'utf-8');
        const normalizedNested = await fs.realpath(nestedWT.path);
        expect(content.trim()).toBe(normalizedNested);
      }
    }
  });
});