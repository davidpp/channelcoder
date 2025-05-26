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
    const result = await claude(promptPath, {
      dryRun: true,
      data: {
        // Missing taskId!
        priority: 'high',
        tags: ['bug', 'urgent'],
      },
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('taskId');
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
    const result = await claude(promptPath, {
      dryRun: true,
      data: {
        name: 'Alice',
      },
    });
    
    expect(result.success).toBe(true);
    expect(result.data.fullCommand).toMatchSnapshot();
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
    const result = await claude(promptPath, {
      dryRun: true,
      data: {
        count: 'not a number', // Wrong type!
        active: true,
        items: ['a', 'b'],
      },
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
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
    const result1 = await claude(promptPath, {
      dryRun: true,
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
    
    expect(result1.success).toBe(true);
    expect(result1.data.fullCommand).toMatchSnapshot();

    // Test with missing nested field
    const result2 = await claude(promptPath, {
      dryRun: true,
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
    
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Input validation failed');
    expect(result2.error).toContain('email');
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
    const result = await claude(promptPath, {
      dryRun: true,
      data: {
        anything: 123,
        whatever: { nested: true },
        extra: 'fields are ok',
      },
    });
    
    expect(result.success).toBe(true);
    expect(result.data.fullCommand).toMatchSnapshot();
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

    const result = await claude(promptPath, {
      dryRun: true,
      data: { task: 'debugging' },
    });
    
    expect(result.success).toBe(true);
    expect(result.data.fullCommand).toMatchSnapshot();
    expect(result.data.fullCommand).toContain('--system-prompt');
    expect(result.data.fullCommand).toContain('You are a helpful assistant');
  });
});