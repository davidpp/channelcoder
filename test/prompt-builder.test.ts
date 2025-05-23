import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { z } from 'zod';
import type { CC } from '../src/cc';
import { PromptBuilder } from '../src/prompt-builder';

describe('PromptBuilder', () => {
  // Mock CC instance
  const mockCC = {
    run: mock(() => Promise.resolve({ success: true })),
    stream: mock(() => {}),
  } as unknown as CC;

  beforeEach(() => {
    mockCC.run.mockClear();
    mockCC.stream.mockClear();
  });

  describe('template building', () => {
    test('should build simple template', () => {
      const builder = new PromptBuilder('Hello ${0}!', ['World'], mockCC);
      expect(builder.toString()).toBe('Hello World!');
    });

    test('should handle multiple values', () => {
      const builder = new PromptBuilder('Task ${0} is ${1}', ['FEAT-123', 'complete'], mockCC);
      expect(builder.toString()).toBe('Task FEAT-123 is complete');
    });

    test('should format objects as JSON', () => {
      const builder = new PromptBuilder('Data: ${0}', [{ key: 'value' }], mockCC);
      expect(builder.toString()).toContain('"key": "value"');
    });

    test('should handle null/undefined gracefully', () => {
      const builder = new PromptBuilder('Value: ${0}, Other: ${1}', [null, undefined], mockCC);
      expect(builder.toString()).toBe('Value: , Other: ');
    });
  });

  describe('fluent API', () => {
    test('should chain configuration methods', () => {
      const builder = new PromptBuilder('Test ${0}', ['prompt'], mockCC)
        .withSystemPrompt('system.md')
        .withTools(['Read', 'Write']);

      // Methods should return the builder for chaining
      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    test('should set system prompt', async () => {
      const builder = new PromptBuilder('Test', [], mockCC).withSystemPrompt('path/to/system.md');

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          systemPrompt: 'path/to/system.md',
        })
      );
    });

    test('should set tools', async () => {
      const builder = new PromptBuilder('Test', [], mockCC).withTools(['Read', 'Grep']);

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          allowedTools: ['Read', 'Grep'],
        })
      );
    });
  });

  describe('schema configuration', () => {
    test('should set input schema', async () => {
      const schema = z.object({ name: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC).withInputSchema(schema);

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          input: schema,
        })
      );
    });

    test('should set output schema', async () => {
      const schema = z.object({ result: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC).withOutputSchema(schema);

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          output: schema,
        })
      );
    });

    test('should support withSchema shorthand', async () => {
      const schema = z.object({ data: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC).withSchema(schema);

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          output: schema,
        })
      );
    });

    test('should accept record schema for input', async () => {
      const recordSchema = {
        name: z.string(),
        age: z.number(),
      };
      const builder = new PromptBuilder('Test', [], mockCC).withInputSchema(recordSchema);

      await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          input: recordSchema,
        })
      );
    });
  });

  describe('execution', () => {
    test('should run prompt through CC', async () => {
      const builder = new PromptBuilder('Execute ${0}', ['this'], mockCC);
      const result = await builder.run();

      expect(mockCC.run).toHaveBeenCalledWith('Execute this', {});
      expect(result).toEqual({ success: true });
    });

    test('should stream prompt through CC', async () => {
      const mockStream = async function* () {
        yield { type: 'content' as const, content: 'test', timestamp: Date.now() };
      };
      mockCC.stream = mock(() => mockStream());

      const builder = new PromptBuilder('Stream ${0}', ['this'], mockCC);
      const chunks = [];

      for await (const chunk of builder.stream()) {
        chunks.push(chunk);
      }

      expect(mockCC.stream).toHaveBeenCalledWith('Stream this', {});
      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('content');
    });
  });
});
