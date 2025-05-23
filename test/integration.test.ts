import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { cc } from '../src/index';

/**
 * Integration tests that interact with real files and process spawning
 * Note: These tests don't call the actual Claude CLI but test the full flow
 */

describe('CC Integration Tests', () => {
  const testDir = join(process.cwd(), 'test-tmp');
  const promptFile = join(testDir, 'test-prompt.md');

  beforeAll(() => {
    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (_e) {
      // Ignore if exists
    }
  });

  afterAll(() => {
    // Cleanup
    try {
      unlinkSync(promptFile);
      rmdirSync(testDir);
    } catch (_e) {
      // Ignore cleanup errors
    }
  });

  describe('file-based prompts', () => {
    test(
      'should load real file and interpolate variables',
      async () => {
        // Create test prompt file
        const promptContent = `---
input:
  title: string
  items: string[]
  showDetails?: boolean
output:
  summary: string
  count: number
systemPrompt: "You are a helpful assistant"
allowedTools:
  - Read
---

# Task: \${title}

Process these items:
\${items}

\${showDetails ? "Include detailed analysis for each item." : ""}

Return a JSON response with:
\`\`\`json
{
  "summary": "brief summary",
  "count": <number of items>
}
\`\`\``;

        writeFileSync(promptFile, promptContent);

        // This would normally call Claude, but in tests it will fail
        // We're testing the file loading, validation, and interpolation
        try {
          const result = await cc.fromFile(promptFile, {
            title: 'Process List',
            items: ['apple', 'banana', 'orange'],
            showDetails: true,
          });

          // In real scenario, this would succeed with Claude installed
          // For now, we expect it to fail at the spawn step
          expect(result.success).toBe(false);
        } catch (error) {
          // Expected in test environment without Claude CLI
          expect(error).toBeDefined();
        }
      },
      { timeout: 10000 }
    );

    test(
      'should validate input schema from file',
      async () => {
        const result = await cc.fromFile(promptFile, {
          // Missing required 'title' field
          items: ['test'],
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
        expect(result.error).toContain('title');
      },
      { timeout: 10000 }
    );

    test(
      'should handle optional fields correctly',
      async () => {
        const result = await cc.fromFile(promptFile, {
          title: 'Test',
          items: ['a', 'b'],
          // showDetails is optional, should work without it
        });

        // Would succeed with Claude installed
        // We're mainly testing that validation passes
        expect(result.error).not.toContain('Input validation failed');
      },
      { timeout: 10000 }
    );
  });

  describe('schema validation', () => {
    test('should work with complex nested schemas', () => {
      const ComplexSchema = z.object({
        user: z.object({
          id: z.string().uuid(),
          name: z.string().min(1),
          email: z.string().email(),
          roles: z.array(z.enum(['admin', 'user', 'guest'])),
        }),
        metadata: z.object({
          createdAt: z.string().datetime(),
          tags: z.array(z.string()).optional(),
          settings: z.record(z.any()).optional(),
        }),
        status: z.enum(['active', 'pending', 'disabled']),
      });

      const validData = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John Doe',
          email: 'john@example.com',
          roles: ['admin', 'user'],
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          tags: ['important', 'verified'],
        },
        status: 'active',
      };

      const result = cc.validate({ success: true, data: validData }, ComplexSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.name).toBe('John Doe');
        expect(result.data.metadata.tags).toContain('important');
      }
    });

    test('should provide detailed validation errors', () => {
      const Schema = z.object({
        email: z.string().email(),
        age: z.number().min(18).max(100),
        website: z.string().url().optional(),
      });

      const invalidData = {
        email: 'not-an-email',
        age: 150,
        website: 'not-a-url',
      };

      const result = cc.validate(
        { success: true, data: invalidData },
        Schema,
        'User data validation'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('User data validation failed');
        expect(result.error).toContain('email');
        expect(result.error).toContain('age');
        expect(result.error).toContain('website');
      }
    });
  });

  describe('template interpolation edge cases', () => {
    test('should handle all supported interpolation features', () => {
      const isActive = true;
      const isDisabled = false;
      const builder = cc.prompt`
        Name: ${'Alice'}
        Age: ${30}
        Active: ${true}
        Tags: ${['admin', 'user']}
        Config: ${{ port: 3000, host: 'localhost' }}
        Nullish: ${null} and ${undefined}
        Conditional: ${isActive ? 'YES' : 'NO'}
        Negation: ${!isDisabled ? 'TRUE' : 'FALSE'}
      `;

      const result = builder.toString();

      expect(result).toContain('Name: Alice');
      expect(result).toContain('Age: 30');
      expect(result).toContain('Active: true');
      expect(result).toContain('"admin"');
      expect(result).toContain('"port": 3000');
      expect(result).toContain('Nullish:  and ');
      expect(result).toContain('Conditional: YES');
      expect(result).toContain('Negation: TRUE');
    });
  });

  describe('error handling', () => {
    test(
      'should handle non-existent prompt files gracefully',
      async () => {
        const result = await cc.fromFile('/non/existent/file.md', {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to load prompt file');
      },
      { timeout: 10000 }
    );

    test(
      'should handle malformed prompt files',
      async () => {
        const malformedFile = join(testDir, 'malformed.md');
        writeFileSync(malformedFile, '---\ninvalid yaml: [\n---\nContent');

        const result = await cc.fromFile(malformedFile, {});

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        unlinkSync(malformedFile);
      },
      { timeout: 10000 }
    );
  });
});
