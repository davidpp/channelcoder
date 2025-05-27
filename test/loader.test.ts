import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { z } from 'zod';
import { loadPromptFile, resolveSystemPrompt } from '../src/loader';

// Mock fs module
mock.module('fs', () => ({
  readFileSync: mock(() => ''),
  existsSync: mock(() => false),
}));

import { existsSync, readFileSync } from 'fs';

// Get mocked functions
const mockedReadFileSync = readFileSync as ReturnType<typeof mock>;
const mockedExistsSync = existsSync as ReturnType<typeof mock>;

describe('loader', () => {
  beforeEach(() => {
    mockedReadFileSync.mockClear();
    mockedExistsSync.mockClear();
  });

  describe('loadPromptFile', () => {
    test('should load and parse prompt file with frontmatter', async () => {
      const mockContent = `---
systemPrompt: "You are helpful"
allowedTools:
  - Read
  - Write
---

# Test Prompt

Hello \${name}!`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(mockedReadFileSync).toHaveBeenCalledWith('test.md', 'utf-8');
      expect(result.config).toEqual({
        systemPrompt: 'You are helpful',
        allowedTools: ['Read', 'Write'],
      });
      expect(result.content).toContain('Hello ${name}!');
    });

    test('should parse input schema from YAML notation', async () => {
      const mockContent = `---
input:
  name: string
  age: number
  optional?: boolean
---
Content`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config.input).toBeDefined();
      expect(result.config.input).toHaveProperty('name');
      expect(result.config.input).toHaveProperty('age');
      // Note: 'optional?' becomes 'optional' (without ?) in the parsed schema
      expect(result.config.input).toHaveProperty('optional');
    });

    test('should parse output schema', async () => {
      const mockContent = `---
output:
  success: boolean
  message: string
---
Content`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config.output).toBeDefined();
      // Output should be a z.object schema
      expect(result.config.output).toBeInstanceOf(z.ZodObject);
    });

    test('should handle complex schema types', async () => {
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

      mockedReadFileSync.mockReturnValue(mockContent);

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

    test('should handle file read errors', async () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(loadPromptFile('missing.md')).rejects.toThrow(
        'Failed to load prompt file missing.md: Error: File not found'
      );
    });

    test('should handle files without frontmatter', async () => {
      const mockContent = 'Just content, no frontmatter';
      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');

      expect(result.config).toEqual({});
      expect(result.content).toBe('Just content, no frontmatter');
    });

    test('should reject invalid frontmatter keys', async () => {
      mockedReadFileSync.mockReturnValue(`---
invalidKey: "This should fail"
temperature: 0.7
systemPrompt: "Valid prompt"
---
Content`);

      await expect(loadPromptFile('test.md')).rejects.toThrow('Invalid frontmatter');
    });
  });

  describe('resolveSystemPrompt', () => {
    test('should load content from .md file if it exists', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('System prompt content');

      const result = await resolveSystemPrompt('system.md');

      expect(mockedExistsSync).toHaveBeenCalledWith('system.md');
      expect(mockedReadFileSync).toHaveBeenCalledWith('system.md', 'utf-8');
      expect(result).toBe('System prompt content');
    });

    test('should load content from .txt file if it exists', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('Text content');

      const result = await resolveSystemPrompt('prompt.txt');

      expect(mockedExistsSync).toHaveBeenCalledWith('prompt.txt');
      expect(result).toBe('Text content');
    });

    test('should return inline content if not a file path', async () => {
      const inline = 'You are a helpful assistant';
      const result = await resolveSystemPrompt(inline);

      expect(mockedExistsSync).not.toHaveBeenCalled();
      expect(result).toBe(inline);
    });

    test('should return path as inline if file does not exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await resolveSystemPrompt('missing.md');

      expect(mockedExistsSync).toHaveBeenCalledWith('missing.md');
      expect(mockedReadFileSync).not.toHaveBeenCalled();
      expect(result).toBe('missing.md');
    });
  });

  describe('schema parsing', () => {
    test('should handle optional fields with ? notation', async () => {
      const mockContent = `---
input:
  required: string
  optional?: string
---
Content`;

      mockedReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFile('test.md');
      const schema = result.config.input as Record<string, z.ZodType>;

      // Test that optional field is actually optional
      const testSchema = z.object(schema);

      // Should pass without optional field
      expect(() => testSchema.parse({ required: 'test' })).not.toThrow();

      // Should fail without required field
      expect(() => testSchema.parse({ optional: 'test' })).toThrow();
    });

    test('should handle array notation with []', async () => {
      const mockContent = `---
input:
  items: string[]
  numbers: number[]
---
Content`;

      mockedReadFileSync.mockReturnValue(mockContent);

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

    test('should handle schema with default values', async () => {
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

      mockedReadFileSync.mockReturnValue(mockContent);

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
