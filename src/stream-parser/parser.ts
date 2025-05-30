/**
 * Core parsing functions for Claude's stream-json format
 */

import type {
  ClaudeEvent,
  StreamChunk,
  AssistantEvent,
} from './types.js';

import {
  isAssistantEvent,
  isToolUseEvent,
  isToolResultEvent,
  isErrorEvent,
  isResultEvent,
} from './types.js';

/**
 * Parse a single JSON event from Claude's stream-json format
 * @param jsonLine - A single line containing a JSON object
 * @returns Parsed event or null if invalid
 */
export function parseStreamEvent(jsonLine: string): ClaudeEvent | null {
  // Skip empty lines
  if (!jsonLine.trim()) {
    return null;
  }

  try {
    const event = JSON.parse(jsonLine);
    
    // Validate event has required type field
    if (!event || typeof event.type !== 'string') {
      return null;
    }
    
    // Basic validation for known event types
    switch (event.type) {
      case 'system':
      case 'assistant':
      case 'result':
      case 'tool_use':
      case 'tool_result':
      case 'error':
        return event as ClaudeEvent;
      default:
        // Unknown event type, but still return it
        // This allows forward compatibility
        return event as ClaudeEvent;
    }
  } catch (error) {
    // Invalid JSON, return null
    return null;
  }
}

/**
 * Convert a Claude event to a simplified StreamChunk
 * @param event - A parsed Claude event
 * @returns StreamChunk or null if not applicable
 */
export function eventToChunk(event: ClaudeEvent): StreamChunk | null {
  const timestamp = Date.now();

  if (isAssistantEvent(event)) {
    const text = extractAssistantText(event);
    if (text) {
      return {
        type: 'content',
        content: text,
        timestamp,
        metadata: {
          session_id: event.session_id,
          message_id: event.message.id,
          model: event.message.model,
        },
      };
    }
  } else if (isToolUseEvent(event)) {
    return {
      type: 'tool_use',
      content: JSON.stringify(event.input, null, 2),
      tool: event.tool,
      timestamp: event.timestamp || timestamp,
      metadata: {
        session_id: event.session_id,
      },
    };
  } else if (isToolResultEvent(event)) {
    return {
      type: 'tool_result',
      content: typeof event.output === 'string' 
        ? event.output 
        : JSON.stringify(event.output, null, 2),
      tool: event.tool,
      timestamp: event.timestamp || timestamp,
      metadata: {
        session_id: event.session_id,
      },
    };
  } else if (isErrorEvent(event)) {
    return {
      type: 'error',
      content: event.error,
      timestamp,
      metadata: {
        code: event.code,
        session_id: event.session_id,
      },
    };
  } else if (isResultEvent(event)) {
    // Only create error chunk for error results
    if (event.subtype === 'error' && event.error) {
      return {
        type: 'error',
        content: event.error,
        timestamp,
        metadata: {
          session_id: event.session_id,
          cost_usd: event.cost_usd,
          duration_ms: event.duration_ms,
        },
      };
    }
  }

  // System events and success results don't convert to chunks
  return null;
}

/**
 * Extract text content from an assistant event
 * @param event - An assistant event
 * @returns Concatenated text content
 */
export function extractAssistantText(event: AssistantEvent): string {
  if (!event.message?.content || !Array.isArray(event.message.content)) {
    return '';
  }

  return event.message.content
    .filter((c): c is { type: 'text'; text: string } => 
      c && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string'
    )
    .map(c => c.text)
    .join('');
}

/**
 * Extract session ID from any event
 * @param event - Any Claude event
 * @returns Session ID or undefined
 */
export function extractSessionId(event: ClaudeEvent): string | undefined {
  // Most events have session_id at top level
  if ('session_id' in event && typeof event.session_id === 'string') {
    return event.session_id;
  }
  
  return undefined;
}

/**
 * Parse multiple lines at once (useful for batch processing)
 * @param lines - Array of JSON lines
 * @returns Array of successfully parsed events
 */
export function parseStreamEvents(lines: string[]): ClaudeEvent[] {
  return lines
    .map(line => parseStreamEvent(line))
    .filter((event): event is ClaudeEvent => event !== null);
}

/**
 * Check if an event represents the end of a conversation
 * @param event - Any Claude event
 * @returns True if this event ends the conversation
 */
export function isTerminalEvent(event: ClaudeEvent): boolean {
  return event.type === 'result' || event.type === 'error';
}