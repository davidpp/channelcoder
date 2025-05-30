import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import {
  parseLogFile,
  readLogLines,
  parseLogStream,
  getLogSummary,
  isValidLogFile,
} from '../../src/stream-parser/file.js';
import { collect } from '../../src/stream-parser/stream.js';

const fixturesPath = join(import.meta.dir, '../fixtures');
const sampleLogPath = join(fixturesPath, 'sample-log.jsonl');
const errorLogPath = join(fixturesPath, 'error-log.jsonl');

describe('parseLogFile', () => {
  test('parses complete log file', async () => {
    const parsed = await parseLogFile(sampleLogPath);
    
    expect(parsed.events).toHaveLength(6);
    expect(parsed.sessionId).toBe('test-session-123');
    expect(parsed.content).toContain('Hello! I\'ll help you with that task.');
    expect(parsed.content).toContain('I\'ve read the file. The result is 42.');
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.metadata.totalCost).toBe(0.0015);
    expect(parsed.metadata.duration).toBe(2500);
    expect(parsed.metadata.turns).toBe(2);
    expect(parsed.metadata.model).toBe('claude-3-opus');
    expect(parsed.metadata.toolsUsed).toContain('Read');
  });

  test('parses error log file', async () => {
    const parsed = await parseLogFile(errorLogPath);
    
    expect(parsed.events).toHaveLength(4);
    expect(parsed.sessionId).toBe('error-session-456');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.metadata.totalCost).toBe(0.0005);
    
    // Check for error event
    const errorEvent = parsed.events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    
    // Check for error result
    const resultEvent = parsed.events.find(e => e.type === 'result');
    expect(resultEvent).toBeDefined();
    expect(resultEvent).toHaveProperty('subtype', 'error');
  });

  test('handles empty file', async () => {
    const emptyPath = join(fixturesPath, 'empty.jsonl');
    await fs.writeFile(emptyPath, '');
    
    const parsed = await parseLogFile(emptyPath);
    
    expect(parsed.events).toHaveLength(0);
    expect(parsed.sessionId).toBeUndefined();
    expect(parsed.content).toBe('');
    expect(parsed.messages).toHaveLength(0);
    
    await fs.unlink(emptyPath);
  });

  test('handles file with invalid lines', async () => {
    const mixedPath = join(fixturesPath, 'mixed.jsonl');
    await fs.writeFile(mixedPath, `
{"type":"system","subtype":"init","session_id":"mixed-123"}
invalid json line
{"type":"assistant","message":{"id":"msg","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Still works"}]},"session_id":"mixed-123"}

{"no":"type"}
`);
    
    const parsed = await parseLogFile(mixedPath);
    
    expect(parsed.events).toHaveLength(2); // Only valid events
    expect(parsed.sessionId).toBe('mixed-123');
    expect(parsed.content).toBe('Still works');
    
    await fs.unlink(mixedPath);
  });
});

describe('readLogLines', () => {
  test('reads lines from file', async () => {
    const lines = await collect(readLogLines(sampleLogPath));
    
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('"type":"system"');
    expect(lines[5]).toContain('"type":"result"');
  });

  test('handles non-existent file', async () => {
    const badPath = join(fixturesPath, 'does-not-exist.jsonl');
    
    await expect(async () => {
      await collect(readLogLines(badPath));
    }).toThrow();
  });
});

describe('parseLogStream', () => {
  test('streams events from file', async () => {
    const events = await collect(parseLogStream(sampleLogPath));
    
    expect(events).toHaveLength(6);
    expect(events[0].type).toBe('system');
    expect(events[1].type).toBe('assistant');
    expect(events[5].type).toBe('result');
  });

  test('memory efficient for large files', async () => {
    // Create a large file with many events
    const largePath = join(fixturesPath, 'large.jsonl');
    const eventCount = 1000;
    
    let content = '';
    for (let i = 0; i < eventCount; i++) {
      content += `{"type":"assistant","message":{"id":"msg_${i}","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Message ${i}"}]},"session_id":"large-test"}\n`;
    }
    await fs.writeFile(largePath, content);
    
    // Stream through file
    let count = 0;
    for await (const event of parseLogStream(largePath)) {
      count++;
      // Early exit to demonstrate streaming
      if (count === 10) break;
    }
    
    expect(count).toBe(10);
    
    await fs.unlink(largePath);
  });
});

describe('getLogSummary', () => {
  test('gets summary without loading full file', async () => {
    const summary = await getLogSummary(sampleLogPath);
    
    expect(summary.sessionId).toBe('test-session-123');
    expect(summary.eventCount).toBe(6);
    expect(summary.messageCount).toBe(2);
    expect(summary.hasErrors).toBe(false);
    expect(summary.totalCost).toBe(0.0015);
    expect(summary.duration).toBe(2500);
  });

  test('detects errors in summary', async () => {
    const summary = await getLogSummary(errorLogPath);
    
    expect(summary.sessionId).toBe('error-session-456');
    expect(summary.hasErrors).toBe(true);
    expect(summary.messageCount).toBe(1);
  });
});

describe('isValidLogFile', () => {
  test('validates correct log file', async () => {
    const isValid = await isValidLogFile(sampleLogPath);
    expect(isValid).toBe(true);
  });

  test('rejects non-existent file', async () => {
    const isValid = await isValidLogFile(join(fixturesPath, 'nope.jsonl'));
    expect(isValid).toBe(false);
  });

  test('rejects non-JSON file', async () => {
    const textPath = join(fixturesPath, 'text.txt');
    await fs.writeFile(textPath, 'This is not JSON\nJust plain text');
    
    const isValid = await isValidLogFile(textPath);
    expect(isValid).toBe(false);
    
    await fs.unlink(textPath);
  });

  test('accepts file with valid event in first line', async () => {
    const partialPath = join(fixturesPath, 'partial.jsonl');
    await fs.writeFile(partialPath, '{"type":"system","session_id":"test"}\ngarbage after this');
    
    const isValid = await isValidLogFile(partialPath);
    expect(isValid).toBe(true);
    
    await fs.unlink(partialPath);
  });
});