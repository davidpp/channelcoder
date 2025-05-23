import { existsSync, readFileSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { loadPromptFile, resolveSystemPrompt } from '../src/loader';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe('loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPromptFile', () => {
    it('should load and parse prompt file with frontmatter', async () => {
      const mockContent = `---
systemPrompt: "You are helpful"
allowedTools:
  - Read
  - Write
---

# Test Prompt

Hello \${name}!`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(readFileSync).toHaveBeenCalledWith('test.md', 'utf-8');
      expect(result.config).toEqual({
        systemPrompt: 'You are helpful',
        allowedTools: ['Read', 'Write'],
      });
      expect(result.content).toContain('Hello ${name}!');
    });

    it('should parse input schema from YAML notation', async () => {
      const mockContent = `---
input:
  name: string
  age: number
  optional?: boolean
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config.input).toBeDefined();
      expect(result.config.input).toHaveProperty('name');
      expect(result.config.input).toHaveProperty('age');
      expect(result.config.input).toHaveProperty('optional');
    });

    it('should parse output schema', async () => {
      const mockContent = `---
output:
  success: boolean
  message: string
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config.output).toBeDefined();
      // Output should be a z.object schema
      expect(result.config.output).toBeInstanceOf(z.ZodObject);
    });

    it('should handle complex schema types', async () => {
      const mockContent = `---
input:
  tags:
    type: array
  status:
    type: string
    enum: [active, inactive]
  count:
    type: number
    min: 0
    max: 100
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config.input).toBeDefined();
      const schema = result.config.input as Record<string, z.ZodType>;

      // Verify array type
      expect(schema.tags).toBeDefined();

      // Verify enum type
      expect(schema.status).toBeDefined();

      // Verify number with constraints
      expect(schema.count).toBeDefined();
    });

    it('should handle file read errors', async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(loadPromptFile('missing.md')).rejects.toThrow(
        'Failed to load prompt file missing.md: Error: File not found'
      );
    });

    it('should handle files without frontmatter', async () => {
      const mockContent = 'Just content, no frontmatter';
      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config).toEqual({});
      expect(result.content).toBe('Just content, no frontmatter');
    });
  });

  describe('resolveSystemPrompt', () => {
    it('should load content from .md file if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('System prompt content');

      const result = await resolveSystemPrompt('system.md');

      expect(existsSync).toHaveBeenCalledWith('system.md');
      expect(readFileSync).toHaveBeenCalledWith('system.md', 'utf-8');
      expect(result).toBe('System prompt content');
    });

    it('should load content from .txt file if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('Text content');

      const result = await resolveSystemPrompt('prompt.txt');

      expect(existsSync).toHaveBeenCalledWith('prompt.txt');
      expect(result).toBe('Text content');
    });

    it('should return inline content if not a file path', async () => {
      const inline = 'You are a helpful assistant';
      const result = await resolveSystemPrompt(inline);

      expect(existsSync).not.toHaveBeenCalled();
      expect(result).toBe(inline);
    });

    it('should return path as inline if file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await resolveSystemPrompt('missing.md');

      expect(existsSync).toHaveBeenCalledWith('missing.md');
      expect(readFileSync).not.toHaveBeenCalled();
      expect(result).toBe('missing.md');
    });
  });

  describe('schema parsing', () => {
    it('should handle optional fields with ? notation', async () => {
      const mockContent = `---
input:
  required: string
  optional?: string
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');
      const schema = result.config.input as Record<string, z.ZodType>;

      // Test that optional field is actually optional
      const testSchema = z.object(schema);

      // Should pass without optional field
      expect(() => testSchema.parse({ required: 'test' })).not.toThrow();

      // Should fail without required field
      expect(() => testSchema.parse({ optional: 'test' })).toThrow();
    });

    it('should handle array notation with []', async () => {
      const mockContent = `---
input:
  items: string[]
  numbers: number[]
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');
      const schema = result.config.input as Record<string, z.ZodType>;

      // Verify array types
      const testSchema = z.object(schema);
      const parsed = testSchema.parse({
        items: ['a', 'b'],
        numbers: [1, 2, 3],
      });

      expect(parsed.items).toEqual(['a', 'b']);
      expect(parsed.numbers).toEqual([1, 2, 3]);
    });

    it('should handle schema with default values', async () => {
      const mockContent = `---
input:
  status:
    type: string
    default: "pending"
  count:
    type: number
    default: 0
---
Content`;

      vi.mocked(readFileSync).mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');
      const schema = result.config.input as Record<string, z.ZodType>;

      const testSchema = z.object(schema);
      const parsed = testSchema.parse({});

      expect(parsed).toEqual({
        status: 'pending',
        count: 0,
      });
    });
  });
});
