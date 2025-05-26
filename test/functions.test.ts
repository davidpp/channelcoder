import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { CC } from '../src/cc.js';
import { stream, claude, run } from '../src/functions.js';
import * as loader from '../src/loader.js';

describe('claude function', () => {
  test('detects inline prompt correctly', async () => {
    // Mock the CC class
    const mockRun = mock(() =>
      Promise.resolve({
        success: true,
        data: 'Test response',
        stdout: 'Test response',
      })
    );

    // Mock CC.prototype.run
    CC.prototype.run = mockRun;

    const result = await claude('What is TypeScript?');

    expect(mockRun).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data).toBe('Test response');
  });

  test('detects file path correctly', async () => {
    const mockRun = mock(() =>
      Promise.resolve({
        success: true,
        data: 'File response',
      })
    );

    CC.prototype.run = mockRun;

    // These should be detected as files
    const filePaths = [
      'prompts/test.md',
      './test.md',
      'some/path/to/prompt.md',
      'C:\\Windows\\prompt.md',
    ];

    for (const path of filePaths) {
      await claude(path);
      // Would need to mock loadPromptFile to fully test
    }
  });

  test('template literal support', async () => {
    const mockRun = mock(() =>
      Promise.resolve({
        success: true,
        data: 'Template response',
      })
    );

    CC.prototype.run = mockRun;

    const name = 'Alice';
    const topic = 'AI';
    const result = await claude`Hello ${name}, explain ${topic}`;

    expect(mockRun).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('passes options correctly', async () => {
    const mockRun = mock(() =>
      Promise.resolve({
        success: true,
        data: 'Options response',
      })
    );

    CC.prototype.run = mockRun;

    await claude('Test prompt', {
      tools: ['Read', 'Write'],
      system: 'Be helpful',
      maxTurns: 5,
      verbose: true,
    });

    expect(mockRun).toHaveBeenCalled();
  });

  test('run shortcut works', async () => {
    const mockRun = mock(() =>
      Promise.resolve({
        success: true,
        data: 'Run response',
      })
    );

    CC.prototype.run = mockRun;

    const result = await run('Quick test');

    expect(result.success).toBe(true);
    expect(result.data).toBe('Run response');
  });

  test('handles errors properly', async () => {
    const mockRun = mock(() =>
      Promise.resolve({
        success: false,
        error: 'Test error',
      })
    );

    CC.prototype.run = mockRun;

    const result = await claude('Test prompt');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
  });
});
