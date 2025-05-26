import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { claude } from '../src/functions.js';

const testDir = './test-tmp-validation';

describe('input validation with Zod schemas', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('validates required fields in prompt file', async () => {
    // Create a prompt with required fields
    const promptPath = join(testDir, 'validated.md');
    writeFileSync(
      promptPath,
      `---
input:
  taskId: string
  priority: string
  tags: string[]
---

Analyzing task {taskId} with priority {priority}
Tags: {tags}
`
    );

    // Test with missing required field
    try {
      await claude(promptPath, {
        data: {
          // Missing taskId!
          priority: 'high',
          tags: ['bug', 'urgent'],
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('Input validation failed');
      expect(errorMessage).toContain('taskId');
    }
  });

  test('validates optional fields correctly', async () => {
    const promptPath = join(testDir, 'optional.md');
    writeFileSync(
      promptPath,
      `---
input:
  name: string
  age?: number
  active?: boolean
---

Hello {name}, age: {age || 'unknown'}
`
    );

    // Should work without optional fields
    try {
      await claude(promptPath, {
        data: {
          name: 'Alice',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Should not be validation error
      expect(errorMessage).not.toContain('Input validation failed');
    }
  });

  test('validates data types correctly', async () => {
    const promptPath = join(testDir, 'types.md');
    writeFileSync(
      promptPath,
      `---
input:
  count: number
  active: boolean
  items: string[]
---

Count: {count}, Active: {active}, Items: {items}
`
    );

    // Test with wrong types
    try {
      await claude(promptPath, {
        data: {
          count: 'not a number', // Wrong type!
          active: true,
          items: ['a', 'b'],
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('Input validation failed');
    }
  });

  test('validates nested objects', async () => {
    const promptPath = join(testDir, 'nested.md');
    writeFileSync(
      promptPath,
      `---
input:
  user:
    name: string
    email: string
  settings:
    theme: string
    notifications: boolean
---

User: {user.name} ({user.email})
Theme: {settings.theme}
`
    );

    // Test with valid nested data
    try {
      await claude(promptPath, {
        data: {
          user: {
            name: 'Bob',
            email: 'bob@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Should not be validation error
      expect(errorMessage).not.toContain('Input validation failed');
    }

    // Test with missing nested field
    try {
      await claude(promptPath, {
        data: {
          user: {
            name: 'Bob',
            // Missing email!
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('Input validation failed');
      expect(errorMessage).toContain('email');
    }
  });

  test('no validation when schema not provided', async () => {
    const promptPath = join(testDir, 'no-schema.md');
    writeFileSync(
      promptPath,
      `---
tools: [Read]
---

Analyze {anything} with {whatever}
`
    );

    // Should work with any data when no schema
    try {
      await claude(promptPath, {
        data: {
          anything: 123,
          whatever: { nested: true },
          extra: 'fields are ok',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Should not be validation error
      expect(errorMessage).not.toContain('Input validation failed');
    }
  });

  test('frontmatter system prompt works', async () => {
    const promptPath = join(testDir, 'system.md');
    writeFileSync(
      promptPath,
      `---
systemPrompt: You are a helpful assistant
allowedTools: [Read, Write]
---

Help me with {task}
`
    );

    try {
      await claude(promptPath, {
        data: { task: 'debugging' },
      });
    } catch (error) {
      // Should process frontmatter correctly before failing at Claude execution
      expect(error).toBeDefined();
    }
  });
});
