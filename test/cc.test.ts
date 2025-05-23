import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { z } from 'zod';
import { CC } from '../src/cc';

// Mock fs module
mock.module('fs', () => ({
  readFileSync: mock(() => ''),
  existsSync: mock(() => false),
}));

import { existsSync, readFileSync } from 'fs';

// Get mocked functions
const mockedReadFileSync = readFileSync as ReturnType<typeof mock>;
const mockedExistsSync = existsSync as ReturnType<typeof mock>;

// Mock process object
const mockProcess = {
  stdin: {
    write: mock(() => {}),
    end: mock(() => {}),
  },
  stdout: {
    getReader: mock(() => {}),
  },
  stderr: {
    getReader: mock(() => {}),
  },
  exited: Promise.resolve(0),
  kill: mock(() => {}),
};

// Mock Bun.spawn
const mockSpawn = spyOn(Bun, 'spawn').mockImplementation(() => mockProcess as any);

describe('CC', () => {
  let cc: CC;

  beforeEach(() => {
    // Reset all mocks
    mockSpawn.mockClear();
    mockProcess.stdin.write.mockClear();
    mockProcess.stdin.end.mockClear();
    mockProcess.stdout.getReader.mockClear();
    mockProcess.stderr.getReader.mockClear();
    mockProcess.kill.mockClear();
    mockedReadFileSync.mockClear();
    mockedExistsSync.mockClear();

    cc = new CC();
    mockSpawn.mockImplementation(() => mockProcess as any);

    // Default mock for successful execution
    mockProcess.stdout.getReader.mockReturnValue({
      read: mock(() => Promise.resolve({ done: true }))
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Success') })
        .mockResolvedValueOnce({ done: true }),
    });
    mockProcess.stderr.getReader.mockReturnValue({
      read: mock(() => Promise.resolve({ done: true })),
    });
  });

  describe('prompt template literal', () => {
    test('should create PromptBuilder with template literal', () => {
      const builder = cc.prompt`Hello ${'World'}!`;
      expect(builder).toBeDefined();
      expect(builder.toString()).toBe('Hello World!');
    });

    test('should handle multiple interpolations', () => {
      const name = 'Alice';
      const role = 'admin';
      const builder = cc.prompt`User ${name} has role ${role}`;
      expect(builder.toString()).toBe('User Alice has role admin');
    });

    test('should execute prompt', async () => {
      const result = await cc.prompt`Test prompt`.run();

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Test prompt');
      expect(result.success).toBe(true);
    });
  });

  describe('fromFile', () => {
    test('should load and execute prompt from file', async () => {
      const mockContent = `---
systemPrompt: "Be helpful"
allowedTools:
  - Read
---
Hello \${name}!`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await cc.fromFile('prompt.md', { name: 'World' });

      expect(mockedReadFileSync).toHaveBeenCalledWith('prompt.md', 'utf-8');
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Hello World!');
      expect(result.success).toBe(true);
    });

    test('should validate input schema', async () => {
      const mockContent = `---
input:
  name: string
  age: number
---
User \${name} is \${age} years old`;

      mockedReadFileSync.mockReturnValue(mockContent);

      // Valid input
      const result1 = await cc.fromFile('prompt.md', { name: 'Alice', age: 30 });
      expect(result1.success).toBe(true);

      // Invalid input (missing required field)
      const result2 = await cc.fromFile('prompt.md', { name: 'Bob' });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Input validation failed');
    });

    test('should handle files without variables', async () => {
      const mockContent = `---
systemPrompt: "Be helpful"
---
Static prompt content`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await cc.fromFile('prompt.md');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Static prompt content');
      expect(result.success).toBe(true);
    });

    test('should handle file load errors', async () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      try {
        await cc.fromFile('missing.md');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Failed to load prompt file');
      }
    });
  });

  describe('run', () => {
    test('should execute string prompt directly', async () => {
      const result = await cc.run('Direct prompt');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Direct prompt');
      expect(result.success).toBe(true);
    });

    test('should execute with options', async () => {
      await cc.run('Test', {
        systemPrompt: 'Be concise',
        allowedTools: ['Read'],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.arrayContaining(['--system-prompt', 'Be concise', '--allowedTools', 'Read']),
        expect.any(Object)
      );
    });

    test('should validate output schema if provided', async () => {
      const outputSchema = z.object({
        success: z.boolean(),
        message: z.string(),
      });

      const jsonResponse = '```json\n{"success": true, "message": "Done"}\n```';
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(jsonResponse) })
          .mockResolvedValueOnce({ done: true }),
      });

      const result = await cc.run('Test', { output: outputSchema });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, message: 'Done' });
    });

    test('should add warning if output validation fails', async () => {
      const outputSchema = z.object({
        requiredField: z.string(),
      });

      const jsonResponse = '```json\n{"wrongField": "value"}\n```';
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(jsonResponse) })
          .mockResolvedValueOnce({ done: true }),
      });

      const result = await cc.run('Test', { output: outputSchema });

      expect(result.success).toBe(true);
      expect(result.warnings?.[0]).toContain('Output validation failed');
    });

    test('should handle execution errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await cc.run('Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });
  });

  describe('stream', () => {
    test('should stream string prompt', async () => {
      const chunks = ['Hello ', 'World!'];
      let chunkIndex = 0;

      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(`{"type": "content", "text": "${chunk}"}\n`),
            });
          }
          return Promise.resolve({ done: true });
        }),
      });

      const received = [];
      for await (const chunk of cc.stream('Test prompt')) {
        received.push(chunk);
      }

      expect(received).toHaveLength(2);
      expect(received[0].content).toBe('Hello ');
      expect(received[1].content).toBe('World!');
    });

    test('should stream PromptBuilder', async () => {
      mockProcess.stdout.getReader.mockReturnValue({
        read: mock(() => Promise.resolve({ done: true }))
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('{"type": "content", "text": "Response"}\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      });

      const builder = cc.prompt`Stream ${'this'}`;
      const chunks = [];

      for await (const chunk of cc.stream(builder)) {
        chunks.push(chunk);
      }

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Stream this');
      expect(chunks).toHaveLength(1);
    });

    test('should yield error chunks on failure', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Stream failed');
      });

      const chunks = [];
      for await (const chunk of cc.stream('Test')) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('Stream failed');
    });
  });

  describe('validate', () => {
    test('should validate successful result with data', () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const result = {
        success: true,
        data: { name: 'test', count: 5 },
      };

      const validated = cc.validate(result, schema);

      expect(validated.success).toBe(true);
      if (validated.success) {
        expect(validated.data).toEqual({ name: 'test', count: 5 });
      }
    });

    test('should handle validation errors', () => {
      const schema = z.object({
        required: z.string(),
      });

      const result = {
        success: true,
        data: { wrong: 'field' },
      };

      const validated = cc.validate(result, schema, 'Test validation');

      expect(validated.success).toBe(false);
      if (!validated.success) {
        expect(validated.error).toContain('Test validation failed');
        expect(validated.error).toContain('required');
      }
    });

    test('should handle failed results', () => {
      const schema = z.object({ any: z.string() });

      const result = {
        success: false,
        error: 'Command failed',
      };

      const validated = cc.validate(result, schema);

      expect(validated.success).toBe(false);
      if (!validated.success) {
        expect(validated.error).toContain('Operation failed: Command failed');
      }
    });

    test('should handle missing data', () => {
      const schema = z.object({ any: z.string() });

      const result = {
        success: true,
        // No data field
      };

      const validated = cc.validate(result, schema);

      expect(validated.success).toBe(false);
      if (!validated.success) {
        expect(validated.error).toContain('did not return any data');
      }
    });
  });
});
