import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { CCProcess } from '../src/process';
import type { CCOptions, PromptConfig } from '../src/types';

// Mock Bun.spawn
const mockSpawn = vi.fn();
const mockProcess = {
  stdin: {
    write: vi.fn(),
    end: vi.fn()
  },
  stdout: {
    getReader: vi.fn()
  },
  stderr: {
    getReader: vi.fn()
  },
  exited: Promise.resolve(0),
  kill: vi.fn()
};

// @ts-ignore
global.Bun = {
  spawn: mockSpawn
};

// Mock fs for system prompt resolution
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

describe('CCProcess', () => {
  let process: CCProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    process = new CCProcess({ verbose: false });
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe('execute', () => {
    it('should execute basic prompt', async () => {
      const mockStdout = 'Response from Claude';
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStdout) })
          .mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const result = await process.execute('Test prompt', {});

      expect(mockSpawn).toHaveBeenCalledWith(
        ['claude', '-p'],
        expect.objectContaining({
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe'
        })
      );
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Test prompt');
      expect(mockProcess.stdin.end).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(mockStdout);
    });

    it('should add system prompt to command', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      await process.execute('Test', { systemPrompt: 'Be helpful' });

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['claude', '-p', '--system-prompt', 'Be helpful']),
        expect.any(Object)
      );
    });

    it('should add allowed tools', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      await process.execute('Test', { allowedTools: ['Read', 'Write'] });

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['claude', '-p', '--allowedTools', 'Read,Write']),
        expect.any(Object)
      );
    });


    it('should parse JSON from code blocks', async () => {
      const jsonResponse = 'Here is the result:\n```json\n{"success": true, "data": "test"}\n```';
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(jsonResponse) })
          .mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, data: 'test' });
    });

    it('should handle process errors', async () => {
      mockProcess.exited = Promise.resolve(1);
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Error occurred') })
          .mockResolvedValueOnce({ done: true })
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Process exited with code 1');
      expect(result.stderr).toBe('Error occurred');
    });

    it('should handle timeout', async () => {
      vi.useFakeTimers();
      
      let resolveExited: (value: number) => void;
      mockProcess.exited = new Promise(resolve => { resolveExited = resolve; });
      
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const executePromise = process.execute('Test', { timeout: 1000 });

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);
      
      // Resolve the process exit
      resolveExited!(0);

      const result = await executePromise;

      expect(mockProcess.kill).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should handle spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await process.execute('Test', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Process execution failed: Error: Spawn failed');
    });
  });

  describe('stream', () => {
    it('should stream content chunks', async () => {
      const chunks = [
        '{"type": "content", "text": "Hello "}',
        '{"type": "content", "text": "World!"}'
      ];

      let chunkIndex = 0;
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            return Promise.resolve({ 
              done: false, 
              value: new TextEncoder().encode(chunk + '\n') 
            });
          }
          return Promise.resolve({ done: true });
        })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
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

    it('should add stream-json format and verbose flag', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining([
          'claude', '-p',
          '--output-format', 'stream-json',
          '--verbose'
        ]),
        expect.any(Object)
      );
    });

    it('should handle tool_use events', async () => {
      const toolEvent = JSON.stringify({
        type: 'tool_use',
        name: 'Read',
        input: { file: 'test.txt' }
      });

      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ 
            done: false, 
            value: new TextEncoder().encode(toolEvent + '\n') 
          })
          .mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('tool_use');
      expect(chunks[0].content).toContain('Read');
    });

    it('should handle non-JSON lines as content', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ 
            done: false, 
            value: new TextEncoder().encode('Plain text output\n') 
          })
          .mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('Plain text output');
    });

    it('should yield error on process failure', async () => {
      mockProcess.exited = Promise.resolve(1);
      mockProcess.stdout.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });
      mockProcess.stderr.getReader.mockReturnValue({
        read: vi.fn().mockResolvedValueOnce({ done: true })
      });

      const chunks = [];
      for await (const chunk of process.stream('Test', {})) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.type === 'error')).toBe(true);
      expect(chunks.find(c => c.type === 'error')?.content).toContain('Process exited with code 1');
    });
  });
});