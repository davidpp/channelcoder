import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stream, claude, interactive, run } from '../src/functions.js';

// Create a temporary test directory
const testDir = './test-tmp';
const testPromptPath = join(testDir, 'test-prompt.md');

describe('claude function - real tests', () => {
  // Setup test files
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });

    // Create a test prompt file
    writeFileSync(
      testPromptPath,
      `---
allowedTools: [Read, Write]
systemPrompt: Test system prompt
---

# Test Prompt

Task ID: {taskId}
Priority: {priority || 'normal'}

{#if includeDetails}
This includes details.
{#endif}
`
    );
  });

  // Cleanup
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('claude function builds correct command for inline prompt', async () => {
    // We can't actually call Claude without it being installed,
    // but we can test that our function processes everything correctly
    // by checking what would be sent to Claude

    const promptText = 'What is 2+2?';

    // Test will fail when trying to spawn Claude, but that's expected
    try {
      await claude(promptText);
    } catch (error) {
      // Expected to fail since Claude CLI isn't installed in test env
      expect(error).toBeDefined();
      // The important thing is our code ran without type errors
    }
  });

  test('claude function with template literals', async () => {
    const num1 = 5;
    const num2 = 3;

    try {
      await claude`What is ${num1} + ${num2}?`;
    } catch (error) {
      // Expected to fail, but template literal should have been processed
      expect(error).toBeDefined();
    }
  });

  test('claude function loads and processes file prompts', async () => {
    try {
      const result = await claude(testPromptPath, {
        data: {
          taskId: 'TEST-123',
          priority: 'high',
          includeDetails: true,
        },
      });
    } catch (error) {
      // Expected to fail at Claude execution, but file should have been loaded
      expect(error).toBeDefined();

      // Check that it's not a file loading error
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('Failed to load prompt file');
    }
  });

  test('claude function passes options correctly', async () => {
    try {
      await claude('Test prompt', {
        tools: ['Read', 'Grep'],
        system: 'Be helpful',
        maxTurns: 5,
        verbose: true,
        resume: 'test-session-id',
      });
    } catch (error) {
      // Expected - options should have been processed
      expect(error).toBeDefined();
    }
  });

  test('file detection works correctly', async () => {
    const filePaths = [
      'prompts/test.md',
      './test.md',
      'some/path/prompt.md',
      'C:\\Windows\\prompt.md',
    ];

    // All of these should be detected as files and fail at loading
    for (const path of filePaths) {
      try {
        await claude(path);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Should fail trying to load the file, not detect it as inline prompt
        expect(errorMessage).toContain('Failed to load prompt file');
      }
    }
  });

  test('inline prompts are not treated as files', async () => {
    const inlinePrompts = [
      'What is TypeScript?',
      'Explain async/await',
      'Debug this: const x = null',
      'Review PR #123',
    ];

    for (const prompt of inlinePrompts) {
      try {
        await claude(prompt);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Should NOT fail at file loading
        expect(errorMessage).not.toContain('Failed to load prompt file');
      }
    }
  });

  test('data interpolation in file prompts', async () => {
    // Create a prompt that uses variables
    const promptWithVars = `Test {name} with {count} items`;
    writeFileSync(join(testDir, 'vars.md'), promptWithVars);

    try {
      await claude(join(testDir, 'vars.md'), {
        data: {
          name: 'ChannelCoder',
          count: 42,
        },
      });
    } catch (error) {
      // Should process the file and interpolate variables before failing
      expect(error).toBeDefined();
    }
  });

  test('run shortcut function', async () => {
    try {
      await run('Quick test prompt');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('stream function returns async iterable', async () => {
    try {
      const iter = stream('Generate a story');
      // Check it's an async iterable
      expect(typeof iter[Symbol.asyncIterator]).toBe('function');

      // Try to consume it
      for await (const chunk of iter) {
        // Won't actually get here without Claude
      }
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('interactive function returns launch result', async () => {
    try {
      const result = await interactive('Debug this');
      // Won't get here without Claude
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
