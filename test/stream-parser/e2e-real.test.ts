import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { detached } from '../../src/functions.js';
import { getLogSummary, monitorLog, parseLogFile } from '../../src/stream-parser/index.js';
import { isAssistantEvent } from '../../src/stream-parser/types.js';

describe('E2E: Real Claude session parsing', () => {
  test('generates and parses real detached session log', async () => {
    // Generate a unique log file name
    const logFile = `test-e2e-real-${Date.now()}.log`;

    console.log(`Creating real session with log file: ${logFile}`);

    // Start a real detached Claude session with simpler prompt
    const result = await detached('Calculate 2 + 2 and then say DONE', {
      logFile,
      stream: true,
      outputFormat: 'stream-json',
    });

    expect(result.success).toBe(true);
    expect(result.data?.detached).toBe(true);
    console.log(`Detached session started, PID: ${result.data?.pid}`);

    // Wait for the session to complete (monitoring for result event)
    await new Promise<void>((resolve) => {
      console.log('Monitoring for completion...');

      const cleanup = monitorLog(logFile, (event) => {
        console.log(`Event type: ${event.type}`);

        if (event.type === 'result') {
          console.log('Result event received, session complete');
          cleanup();
          resolve();
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        console.log('Timeout reached');
        cleanup();
        resolve();
      }, 30000);
    });

    // Give it a moment to ensure file is fully written
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Now parse the complete log file
    console.log('\nParsing complete log file...');
    const parsed = await parseLogFile(logFile);

    // Verify we got expected data
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.sessionId).toBeTruthy();
    expect(parsed.messages.length).toBeGreaterThan(0);

    // Check for expected content
    const assistantMessages = parsed.messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    const fullContent = assistantMessages.map((m) => m.content).join(' ');
    console.log('Assistant content:', fullContent);

    // Verify expected responses
    expect(fullContent).toContain('4'); // 2 + 2
    expect(fullContent.toUpperCase()).toContain('DONE');

    // Check metadata
    expect(parsed.metadata.totalCost).toBeGreaterThan(0);
    expect(parsed.metadata.duration).toBeGreaterThan(0);
    expect(parsed.metadata.model).toBeTruthy();

    // Test summary function
    const summary = await getLogSummary(logFile);
    expect(summary.sessionId).toBe(parsed.sessionId);
    expect(summary.hasErrors).toBe(false);
    expect(summary.messageCount).toBe(assistantMessages.length);

    // Verify event types
    const eventTypes = new Set(parsed.events.map((e) => e.type));
    expect(eventTypes.has('system')).toBe(true);
    expect(eventTypes.has('assistant')).toBe(true);
    expect(eventTypes.has('result')).toBe(true);

    // Clean up
    await fs.unlink(logFile);
    console.log(`\nTest passed! Cleaned up ${logFile}`);
  }, 60000); // 60 second timeout for the whole test

  test('handles real-time monitoring of active session', async () => {
    const logFile = `test-e2e-monitor-${Date.now()}.log`;

    // Collect events as they arrive
    const collectedEvents: string[] = [];
    let sessionComplete = false;

    // Start monitoring first
    const monitorPromise = new Promise<void>((resolve) => {
      const cleanup = monitorLog(logFile, (event) => {
        collectedEvents.push(event.type);

        if (isAssistantEvent(event)) {
          console.log('Assistant message received');
        }

        if (event.type === 'result') {
          sessionComplete = true;
          cleanup();
          resolve();
        }
      });

      setTimeout(() => {
        cleanup();
        resolve();
      }, 30000);
    });

    // Give monitor time to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Start detached session
    const result = await detached(
      `
      MONITOR TEST: Count slowly from 1 to 3, taking your time.
    `,
      {
        logFile,
        stream: true,
        outputFormat: 'stream-json',
      }
    );

    expect(result.success).toBe(true);

    // Wait for monitoring to complete
    await monitorPromise;

    // Verify we collected events in real-time
    expect(collectedEvents.length).toBeGreaterThan(0);
    expect(collectedEvents).toContain('system');
    expect(collectedEvents).toContain('assistant');
    expect(collectedEvents).toContain('result');
    expect(sessionComplete).toBe(true);

    // Clean up
    await fs.unlink(logFile);
  }, 60000);
});
