/**
 * File operations for parsing Claude log files
 */

import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import * as readline from 'node:readline';
import { extractAssistantText, extractSessionId, parseStreamEvent } from './parser.js';
import type { ClaudeEvent, Message, ParsedLog } from './types.js';
import { isAssistantEvent, isResultEvent, isSystemEvent } from './types.js';

/**
 * Parse a complete log file
 * @param logPath - Path to the log file
 * @returns Structured representation of the log
 */
export async function parseLogFile(logPath: string): Promise<ParsedLog> {
  const content = await fs.readFile(logPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  const events: ClaudeEvent[] = [];
  const messages: Message[] = [];
  const toolsUsed = new Set<string>();

  let sessionId: string | undefined;
  let totalCost = 0;
  let duration = 0;
  let turns = 0;
  let model: string | undefined;

  // Parse all events
  for (const line of lines) {
    const event = parseStreamEvent(line);
    if (!event) continue;

    events.push(event);

    // Extract metadata based on event type
    switch (event.type) {
      case 'system':
        if (isSystemEvent(event)) {
          sessionId = event.session_id;
          // Track available tools (not necessarily used)
        }
        break;

      case 'assistant':
        if (isAssistantEvent(event)) {
          const text = extractAssistantText(event);
          if (text) {
            messages.push({
              role: 'assistant',
              content: text,
              timestamp: Date.now(),
              sessionId: event.session_id,
            });
          }

          // Extract model info
          if (!model && event.message.model) {
            model = event.message.model;
          }

          // Update session ID
          if (!sessionId) {
            sessionId = event.session_id;
          }
        }
        break;

      case 'tool_use':
        toolsUsed.add(event.tool);
        break;

      case 'result':
        if (isResultEvent(event)) {
          // Accumulate costs
          if (event.cost_usd) {
            totalCost = event.total_cost || event.cost_usd;
          }

          // Track duration and turns
          if (event.duration_ms) {
            duration = event.duration_ms;
          }
          if (event.num_turns) {
            turns = event.num_turns;
          }

          // Update session ID if not set
          if (!sessionId && event.session_id) {
            sessionId = event.session_id;
          }
        }
        break;
    }

    // Extract session ID from any event
    const eventSessionId = extractSessionId(event);
    if (eventSessionId && !sessionId) {
      sessionId = eventSessionId;
    }
  }

  // Create simplified chunks (backward compatibility)
  const chunks = events
    .map((event) => {
      if (isAssistantEvent(event)) {
        const text = extractAssistantText(event);
        if (text) {
          return {
            type: 'content' as const,
            content: text,
            timestamp: Date.now(),
            metadata: {
              session_id: event.session_id,
              message_id: event.message.id,
            },
          };
        }
      }
      return null;
    })
    .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== null);

  // Concatenate all assistant messages
  const assistantContent = messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content)
    .join('\n');

  return {
    events,
    chunks,
    sessionId,
    content: assistantContent,
    messages,
    metadata: {
      totalCost: totalCost > 0 ? totalCost : undefined,
      duration: duration > 0 ? duration : undefined,
      turns: turns > 0 ? turns : undefined,
      model,
      toolsUsed: toolsUsed.size > 0 ? Array.from(toolsUsed) : undefined,
    },
  };
}

/**
 * Create a line-by-line reader for large files
 * @param logPath - Path to the log file
 * @yields Individual lines from the file
 */
export async function* readLogLines(logPath: string): AsyncIterable<string> {
  const stream = createReadStream(logPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of rl) {
    yield line;
  }
}

/**
 * Parse a log file as a stream (memory efficient for large files)
 * @param logPath - Path to the log file
 * @yields Parsed events
 */
export async function* parseLogStream(logPath: string): AsyncIterable<ClaudeEvent> {
  const lines = readLogLines(logPath);

  for await (const line of lines) {
    const event = parseStreamEvent(line);
    if (event) {
      yield event;
    }
  }
}

/**
 * Get a quick summary of a log file without loading everything
 * @param logPath - Path to the log file
 * @returns Summary statistics
 */
export async function getLogSummary(logPath: string): Promise<{
  sessionId?: string;
  eventCount: number;
  messageCount: number;
  hasErrors: boolean;
  totalCost?: number;
  duration?: number;
}> {
  let sessionId: string | undefined;
  let eventCount = 0;
  let messageCount = 0;
  let hasErrors = false;
  let totalCost: number | undefined;
  let duration: number | undefined;

  for await (const event of parseLogStream(logPath)) {
    eventCount++;

    // Extract session ID from first event that has it
    if (!sessionId) {
      sessionId = extractSessionId(event);
    }

    // Count messages
    if (isAssistantEvent(event)) {
      messageCount++;
    }

    // Check for errors
    if (event.type === 'error' || (isResultEvent(event) && event.subtype === 'error')) {
      hasErrors = true;
    }

    // Extract final cost and duration
    if (isResultEvent(event)) {
      if (event.total_cost) {
        totalCost = event.total_cost;
      }
      if (event.duration_ms) {
        duration = event.duration_ms;
      }
    }
  }

  return {
    sessionId,
    eventCount,
    messageCount,
    hasErrors,
    totalCost,
    duration,
  };
}

/**
 * Check if a file contains valid Claude log data
 * @param logPath - Path to the log file
 * @returns True if the file appears to be a valid log
 */
export async function isValidLogFile(logPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(logPath);
    if (!stats.isFile()) {
      return false;
    }

    // Read first few lines to check format
    const stream = createReadStream(logPath, {
      encoding: 'utf-8',
      end: 1024, // Read only first 1KB
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    let validEventFound = false;

    for await (const line of rl) {
      const event = parseStreamEvent(line);
      if (event?.type) {
        validEventFound = true;
        break;
      }
    }

    rl.close();
    stream.destroy();

    return validEventFound;
  } catch {
    return false;
  }
}
