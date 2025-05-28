import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { session } from '../src/index.js';
import { FileSessionStorage } from '../src/session-storage.js';
import type { SessionState, SessionStorage } from '../src/session.js';

describe('Session E2E Tests', () => {
  let testDir: string;
  let storage: SessionStorage;

  beforeEach(async () => {
    // Create temp directory for test sessions
    testDir = join(tmpdir(), `channelcoder-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new FileSessionStorage(join(testDir, 'sessions'));
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('session workflow with dry-run mode', async () => {
    // Create a new session
    const s = session({ storage });

    // First interaction - check it doesn't have resume flag
    const result1 = await s.claude('What is TypeScript?', { dryRun: true });
    expect(result1.success).toBe(true);
    expect(result1.data.args).not.toContain('--resume');

    // In dry-run mode, session IDs won't be captured from Claude
    // So we can't test the resume behavior without mocking

    // But we can verify the session can be saved even without messages
    const savedPath = await s.save('typescript-learning');
    expect(savedPath).toContain('typescript-learning.json');

    // Verify file was created
    const savedContent = await fs.readFile(savedPath, 'utf-8');
    const savedState = JSON.parse(savedContent);
    expect(savedState.sessionChain).toEqual([]); // Empty in dry-run
    expect(savedState.metadata.name).toBe('typescript-learning');
  });

  test('loading and continuing a session', async () => {
    // First, manually create a session state to test loading
    const sessionState: SessionState = {
      sessionChain: ['session-abc', 'session-def'],
      currentSessionId: 'session-def',
      messages: [
        {
          role: 'user',
          content: 'What is async/await?',
          timestamp: new Date(),
          sessionId: 'session-abc',
        },
        {
          role: 'assistant',
          content: 'Async/await is a way to handle asynchronous operations...',
          timestamp: new Date(),
          sessionId: 'session-abc',
        },
      ],
      metadata: {
        name: 'async-learning',
        created: new Date(),
        lastActive: new Date(),
      },
    };

    // Save it directly via storage
    await storage.save(sessionState, 'async-learning');

    // Load the session
    const s2 = await session.load('async-learning', storage);

    // Verify session was loaded correctly
    expect(s2.id()).toBe('session-def');
    expect(s2.messages()).toHaveLength(2);

    // Continue the conversation
    const result = await s2.claude('Can you show me error handling?', { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.args).toContain('--resume');
    expect(result.data.args).toContain('session-def');
  });

  test('session list functionality', async () => {
    // Create multiple sessions
    const session1State: SessionState = {
      sessionChain: ['s1'],
      currentSessionId: 's1',
      messages: [{ role: 'user', content: 'Test 1', timestamp: new Date(), sessionId: 's1' }],
      metadata: {
        name: 'debugging-session',
        created: new Date('2024-01-01'),
        lastActive: new Date('2024-01-01'),
      },
    };

    const session2State: SessionState = {
      sessionChain: ['s2', 's3'],
      currentSessionId: 's3',
      messages: [
        { role: 'user', content: 'Test 2', timestamp: new Date(), sessionId: 's2' },
        { role: 'assistant', content: 'Response', timestamp: new Date(), sessionId: 's2' },
        { role: 'user', content: 'Follow up', timestamp: new Date(), sessionId: 's3' },
      ],
      metadata: {
        name: 'feature-planning',
        created: new Date('2024-01-02'),
        lastActive: new Date('2024-01-03'),
      },
    };

    await storage.save(session1State, 'debugging-session');
    await storage.save(session2State, 'feature-planning');

    // List sessions
    const sessions = await session.list(storage);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].name).toBe('feature-planning'); // Should be sorted by lastActive
    expect(sessions[0].messageCount).toBe(3);
    expect(sessions[1].name).toBe('debugging-session');
    expect(sessions[1].messageCount).toBe(1);
  });

  test('session with file-based prompts', async () => {
    // Create a test prompt file
    const promptPath = join(testDir, 'test-prompt.md');
    await fs.writeFile(
      promptPath,
      `---
input:
  task: string
---
# Task: {task}

Please help me with this task.`
    );

    const s = session({ storage });

    // Use file-based prompt
    const result = await s.claude(promptPath, {
      data: { task: 'refactoring' },
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.data.prompt).toContain('Task: refactoring');
    expect(result.data.prompt).toContain('Please help me with this task.');
  });

  test('session-required prompt validation', async () => {
    // Create a prompt that requires a session
    const promptPath = join(testDir, 'session-required.md');
    await fs.writeFile(
      promptPath,
      `---
session:
  required: true
---
Continue our discussion about the bug.`
    );

    const s = session({ storage });

    // This should work since we're using a session
    const result = await s.claude(promptPath, { dryRun: true });
    expect(result.success).toBe(true);

    // Without session wrapper, this would fail validation
    // (though we can't test that here without modifying the loader)
  });

  test('template literal support with sessions', async () => {
    const s = session({ storage });

    // Template literals work but testing them is tricky
    // In real usage: await s.claude`Explain ${topic} in JavaScript`
    const result = await s.claude('Explain promises in JavaScript', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.data.prompt).toBe('Explain promises in JavaScript');
  });

  test('streaming with sessions', async () => {
    const s = session({ storage });

    // Stream mode should maintain session context
    // We can't actually test streaming without mocking since it needs Claude CLI
    // But we can verify the function exists and returns an async iterable
    const streamResult = s.stream('Tell me a story');
    expect(streamResult[Symbol.asyncIterator]).toBeDefined();

    // The stream function should work with options
    const streamWithOptions = s.stream('Tell me another story', { parse: true });
    expect(streamWithOptions[Symbol.asyncIterator]).toBeDefined();
  });

  test('session clear functionality', async () => {
    // Create a session with some history
    const sessionState: SessionState = {
      sessionChain: ['s1', 's2'],
      currentSessionId: 's2',
      messages: [{ role: 'user', content: 'Test', timestamp: new Date(), sessionId: 's1' }],
      metadata: {
        name: 'test-clear',
        created: new Date(),
        lastActive: new Date(),
      },
    };

    await storage.save(sessionState, 'test-clear');
    const s = await session.load('test-clear', storage);

    // Verify it loaded with data
    expect(s.id()).toBe('s2');
    expect(s.messages()).toHaveLength(1);

    // Clear session
    s.clear();

    // Verify state is cleared
    expect(s.id()).toBeUndefined();
    expect(s.messages()).toEqual([]);
  });

  test('concurrent session usage', async () => {
    // Create two independent sessions
    const debugSession = session({ name: 'debug', storage });
    const featureSession = session({ name: 'feature', storage });

    // Use them independently
    const debugResult = await debugSession.claude('Debug this error', { dryRun: true });
    const featureResult = await featureSession.claude('Plan new feature', { dryRun: true });

    expect(debugResult.success).toBe(true);
    expect(featureResult.success).toBe(true);

    // They should have independent prompts
    expect(debugResult.data.prompt).toBe('Debug this error');
    expect(featureResult.data.prompt).toBe('Plan new feature');
  });
});
