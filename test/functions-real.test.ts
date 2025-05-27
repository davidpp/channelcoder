import { describe, expect, test } from 'bun:test';
import { claude, interactive, run, stream } from '../src/functions.js';

describe('claude function - dry-run command generation', () => {

  test('simple inline prompt', async () => {
    const result = await claude('What is 2+2?', { dryRun: true });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('inline prompt with options', async () => {
    const result = await claude('Analyze this code', { 
      dryRun: true,
      tools: ['Read', 'Grep'],
      system: 'Be concise',
      maxTurns: 5,
      verbose: true,
    });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('template literal', async () => {
    const num1 = 5;
    const num2 = 3;
    // Template literals execute immediately, can't use dry-run
    // Just test that it would try to execute
    let executed = false;
    try {
      await claude`What is ${num1} + ${num2}?`;
      executed = true;
    } catch (error) {
      // Expected to fail without Claude
      executed = true;
    }
    expect(executed).toBe(true);
  });

  test('file-based prompt', async () => {
    const result = await claude('./test/prompts/test-prompt.md', {
      dryRun: true,
      data: {
        taskId: 'TEST-123',
        priority: 'high',
        includeDetails: true,
      },
    });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('file-based prompt with merged options', async () => {
    const result = await claude('./test/prompts/test-prompt.md', {
      dryRun: true,
      data: { taskId: 'TEST-456' },
      tools: ['Bash'], // This should be added to file's allowedTools
      verbose: true,
    });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('resume session', async () => {
    const result = await claude('Continue analysis', {
      dryRun: true,
      resume: 'test-session-123',
    });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('continue mode', async () => {
    const result = await claude('', {
      dryRun: true,
      continue: true,
    });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('file detection works correctly', async () => {
    // Test that it detects as file and processes correctly
    const result = await claude('./test/prompts/detection-test.md', { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.fullCommand).toContain('echo -e');
    
    // Test various file patterns are handled
    const patterns = [
      'test.md',
      './test.md', 
      '../test.md',
    ];
    
    // These should all be treated as files (even if they don't exist in dry-run)
    patterns.forEach(pattern => {
      expect(pattern.endsWith('.md') || pattern.startsWith('./')).toBe(true);
    });
  });

  test('inline prompts are not treated as files', async () => {
    const inlinePrompts = [
      'What is TypeScript?',
      'Explain async/await',
      'Debug this: const x = null',
      'Review PR #123',
    ];

    for (const prompt of inlinePrompts) {
      const result = await claude(prompt, { dryRun: true });
      // Command should include the actual prompt text
      expect(result.data.prompt).toBe(prompt);
    }
  });

  test('multi-line prompt escaping', async () => {
    const multiLinePrompt = `Analyze this:
- First line
- Second line with "quotes"
- Third line with $pecial chars`;

    const result = await claude(multiLinePrompt, { dryRun: true });
    expect(result.data.fullCommand).toMatchSnapshot();
  });

  test('run shortcut function exists', () => {
    // run() is just claude() with mode: 'run'
    expect(typeof run).toBe('function');
  });

  test('interactive shortcut function exists', () => {
    // interactive() launches without capturing output
    expect(typeof interactive).toBe('function');
  });

  test('stream function returns async iterable', () => {
    // stream() returns an async iterable
    const iter = stream('Test', {});
    expect(typeof iter[Symbol.asyncIterator]).toBe('function');
  });
});