import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'events';
import { CCProcess } from '../src/process';
import type { CCOptions, PromptConfig } from '../src/types';

// Mock fs module for system prompt resolution
mock.module('fs', () => ({
  existsSync: mock(() => false),
  readFileSync: mock(() => ''),
}));

// Mock child_process module
let mockSpawn: ReturnType<typeof mock>;
let mockChildProcess: any;

mock.module('child_process', () => {
  mockSpawn = mock(() => mockChildProcess);
  return {
    spawn: mockSpawn,
  };
});

import { existsSync, readFileSync } from 'fs';

// Get mocked functions
const mockedExistsSync = existsSync as ReturnType<typeof mock>;
const mockedReadFileSync = readFileSync as ReturnType<typeof mock>;

// Create a mock child process that extends EventEmitter
class MockChildProcess extends EventEmitter {
  stdin = {
    write: mock(() => true),
    end: mock(() => {}),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = mock(() => true);

  constructor(public exitCode = 0) {
    super();
  }

  // Helper to simulate process exit
  simulateExit() {
    this.emit('exit', this.exitCode);
  }

  // Helper to simulate stdout data
  simulateStdout(data: string) {
    this.stdout.emit('data', Buffer.from(data));
  }

  // Helper to simulate stderr data
  simulateStderr(data: string) {
    this.stderr.emit('data', Buffer.from(data));
  }
}

// Default mock process
let mockProcess: MockChildProcess;

describe('CCProcess', () => {
  let process: CCProcess;

  beforeEach(() => {
    // Reset all mocks
    if (mockSpawn) mockSpawn.mockClear();
    mockedExistsSync.mockClear();
    mockedReadFileSync.mockClear();

    // Create fresh mock process for each test
    mockProcess = new MockChildProcess();
    mockChildProcess = mockProcess;

    process = new CCProcess({ verbose: false });
  });

  describe('execute', () => {
    test('should execute basic prompt', async () => {
      const mockStdout = 'Response from Claude';
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStdout) })
          .mockResolvedValueOnce({ done: true }),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const result = await process.execute('Test prompt', {});

      expect(mockSpawn).toHaveBeenCalledWith(
        ['claude', '-p'],
        expect.objectContaining({
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        })
      );
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Test prompt');
      expect(mockProcess.stdin.end).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(mockStdout);
    });

    test('should add system prompt to command', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      await process.execute('Test', { systemPrompt: 'Be helpful' });

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['claude', '-p', '--system-prompt', 'Be helpful']),
        expect.any(Object)
      );
    });

    test('should add allowed tools', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      await process.execute('Test', { allowedTools: ['Read', 'Write'] });

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['claude', '-p', '--allowedTools', 'Read,Write']),
        expect.any(Object)
      );
    });

    test('should parse JSON from code blocks', async () => {
      const jsonResponse = 'Here is the result:\n```json\n{"success": true, "data": "test"}\n```';
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(jsonResponse) })
          .mockResolvedValueOnce({ done: true }),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, data: 'test' });
    });

    test('should handle process errors', async () => {
      // Create a mock process with exit code 1
      const errorProcess = createMockProcess(1);
      mockSpawn.mockImplementation(() => errorProcess as any);

      errorProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });
      errorProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Error occurred') })
          .mockResolvedValueOnce({ done: true }),
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Process exited with code 1');
      expect(result.stderr).toBe('Error occurred');
    });

    test.skip(
      'should handle timeout',
      async () => {
        let resolveExited: (value: number) => void;
        mockProcess.exited = new Promise((resolve) => {
          resolveExited = resolve;
        });

        mockProcess.stdout.getReader.mockReturnValue({
          read: mock(() => new Promise(() => {})), // Never resolves
        });
        mockProcess.stderr.getReader.mockReturnValue({
          read: mock(() => Promise.resolve({ done: true })),
        });

        const executePromise = process.execute('Test', { timeout: 100 });

        // Wait a bit for the timeout to trigger
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Resolve the process exit
        resolveExited?.(0);

        const result = await executePromise;

        expect(mockProcess.kill).toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      },
      { timeout: 5000 }
    );

    test('should handle spawn errors', async () => {
      // Claude is already marked as available, so version check won't run
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Process execution failed: Error: Spawn failed');
    });

    test('should detect when Claude CLI is not available', async () => {
      // Create a new process instance with availability check enabled
      const testProcess = new CCProcess({ verbose: false });
      (testProcess as any).skipAvailabilityCheck = false;

      // Create separate mock processes for this test
      const versionCheckProcess = createMockProcess(1);
      const regularProcess = createMockProcess();

      mockSpawn.mockImplementation((cmd) => {
        if (cmd[0] === 'claude' && cmd[1] === '--version') {
          return versionCheckProcess as any;
        }
        return regularProcess as any;
      });

      const result = await testProcess.execute('Test', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Claude CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code'
      );
    });
  });

  describe('stream', () => {
    test('should stream content chunks', async () => {
      const chunks = [
        '{"type": "content", "text": "Hello "}',
        '{"type": "content", "text": "World!"}',
      ];

      let chunkIndex = 0;
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`${chunk}\n`),
            });
          }
          return Promise.resolve({ done: true });
        }),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const received = [];
      for await (const chunk of process.stream('Test', {})) {
        received.push(chunk);
      }

      expect(received).toHaveLength(2);
      expect(received[0].type).toBe('content');
      expect(received[0].content).toBe('Hello ');
      expect(received[1].content).toBe('World!');
    });

    test('should add stream-json format and verbose flag', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['claude', '-p', '--output-format', 'stream-json', '--verbose']),
        expect.any(Object)
      );
    });

    test('should handle tool_use events', async () => {
      const toolEvent = JSON.stringify({
        type: 'tool_use',
        name: 'Read',
        input: { file: 'test.txt' },
      });

      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(`${toolEvent}\n`),
          })
          .mockResolvedValueOnce({ done: true }),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('tool_use');
      expect(chunks[0].content).toContain('Read');
    });

    test('should handle non-JSON lines as content', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('Plain text output\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('Plain text output');
    });

    test('should yield error on process failure', async () => {
      // Create a mock process with exit code 1
      const errorProcess = createMockProcess(1);
      mockSpawn.mockImplementation(() => errorProcess as any);

      errorProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });
      errorProcess.stderr.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true })),
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks.some((c) => c.type === 'error')).toBe(true);
      expect(chunks.find((c) => c.type === 'error')?.content).toContain(
        'Process exited with code 1'
      );
    });
  });
});
