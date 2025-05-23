import { describe, it, expect, vi } from 'vitest';
import { PromptBuilder } from '../src/prompt-builder';
import { CC } from '../src/cc';
import { z } from 'zod';

describe('PromptBuilder', () => {
  // Mock CC instance
  const mockCC = {
    run: vi.fn().mockResolvedValue({ success: true }),
    stream: vi.fn()
  } as unknown as CC;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('template building', () => {
    it('should build simple template', () => {
      const builder = new PromptBuilder('Hello ${0}!', ['World'], mockCC);
      expect(builder.toString()).toBe('Hello World!');
    });

    it('should handle multiple values', () => {
      const builder = new PromptBuilder(
        'Task ${0} is ${1}',
        ['FEAT-123', 'complete'],
        mockCC
      );
      expect(builder.toString()).toBe('Task FEAT-123 is complete');
    });

    it('should format objects as JSON', () => {
      const builder = new PromptBuilder(
        'Data: ${0}',
        [{ key: 'value' }],
        mockCC
      );
      expect(builder.toString()).toContain('"key": "value"');
    });

    it('should handle null/undefined gracefully', () => {
      const builder = new PromptBuilder(
        'Value: ${0}, Other: ${1}',
        [null, undefined],
        mockCC
      );
      expect(builder.toString()).toBe('Value: , Other: ');
    });
  });

  describe('fluent API', () => {
    it('should chain configuration methods', () => {
      const builder = new PromptBuilder('Test ${0}', ['prompt'], mockCC)
        .withSystemPrompt('system.md')
        .withTools(['Read', 'Write']);

      // Methods should return the builder for chaining
      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    it('should set system prompt', async () => {
      const builder = new PromptBuilder('Test', [], mockCC)
        .withSystemPrompt('path/to/system.md');
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          systemPrompt: 'path/to/system.md'
        })
      );
    });

    it('should set tools', async () => {
      const builder = new PromptBuilder('Test', [], mockCC)
        .withTools(['Read', 'Grep']);
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          allowedTools: ['Read', 'Grep']
        })
      );
    });

  });

  describe('schema configuration', () => {
    it('should set input schema', async () => {
      const schema = z.object({ name: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC)
        .withInputSchema(schema);
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          input: schema
        })
      );
    });

    it('should set output schema', async () => {
      const schema = z.object({ result: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC)
        .withOutputSchema(schema);
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          output: schema
        })
      );
    });

    it('should support withSchema shorthand', async () => {
      const schema = z.object({ data: z.string() });
      const builder = new PromptBuilder('Test', [], mockCC)
        .withSchema(schema);
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          output: schema
        })
      );
    });

    it('should accept record schema for input', async () => {
      const recordSchema = {
        name: z.string(),
        age: z.number()
      };
      const builder = new PromptBuilder('Test', [], mockCC)
        .withInputSchema(recordSchema);
      
      await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          input: recordSchema
        })
      );
    });
  });

  describe('execution', () => {
    it('should run prompt through CC', async () => {
      const builder = new PromptBuilder('Execute ${0}', ['this'], mockCC);
      const result = await builder.run();
      
      expect(mockCC.run).toHaveBeenCalledWith('Execute this', {});
      expect(result).toEqual({ success: true });
    });

    it('should stream prompt through CC', async () => {
      const mockStream = async function* () {
        yield { type: 'content' as const, content: 'test', timestamp: Date.now() };
      };
      mockCC.stream = vi.fn().mockReturnValue(mockStream());

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