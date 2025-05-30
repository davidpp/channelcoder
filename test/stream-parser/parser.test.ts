import { describe, expect, test } from 'bun:test';
import {
  parseStreamEvent,
  eventToChunk,
  extractAssistantText,
  extractSessionId,
  parseStreamEvents,
  isTerminalEvent,
} from '../../src/stream-parser/parser.js';
import type { ClaudeEvent, AssistantEvent } from '../../src/stream-parser/types.js';

describe('parseStreamEvent', () => {
  test('parses valid system event', () => {
    const line = '{"type":"system","subtype":"init","session_id":"abc-123","tools":["Read","Write"]}';
    const event = parseStreamEvent(line);
    
    expect(event).not.toBeNull();
    expect(event?.type).toBe('system');
    expect(event).toHaveProperty('session_id', 'abc-123');
  });

  test('parses valid assistant event', () => {
    const line = '{"type":"assistant","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3","content":[{"type":"text","text":"Hello"}]},"session_id":"abc-123"}';
    const event = parseStreamEvent(line);
    
    expect(event).not.toBeNull();
    expect(event?.type).toBe('assistant');
    expect(event).toHaveProperty('session_id', 'abc-123');
  });

  test('parses valid result event', () => {
    const line = '{"type":"result","subtype":"success","cost_usd":0.01,"total_cost":0.01,"duration_ms":1000,"num_turns":1,"result":"Done","is_error":false,"session_id":"abc-123"}';
    const event = parseStreamEvent(line);
    
    expect(event).not.toBeNull();
    expect(event?.type).toBe('result');
    expect(event).toHaveProperty('cost_usd', 0.01);
  });

  test('returns null for empty lines', () => {
    expect(parseStreamEvent('')).toBeNull();
    expect(parseStreamEvent('  ')).toBeNull();
    expect(parseStreamEvent('\n')).toBeNull();
  });

  test('returns null for invalid JSON', () => {
    expect(parseStreamEvent('not json')).toBeNull();
    expect(parseStreamEvent('{invalid')).toBeNull();
    expect(parseStreamEvent('null')).toBeNull();
  });

  test('returns null for JSON without type field', () => {
    expect(parseStreamEvent('{"data": "value"}')).toBeNull();
    expect(parseStreamEvent('{"type": null}')).toBeNull();
  });

  test('handles unknown event types gracefully', () => {
    const line = '{"type":"future_event","data":"something"}';
    const event = parseStreamEvent(line);
    
    expect(event).not.toBeNull();
    expect(event?.type).toBe('future_event');
  });
});

describe('eventToChunk', () => {
  test('converts assistant event to content chunk', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content: [{ type: 'text', text: 'Hello world' }],
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    const chunk = eventToChunk(event);
    
    expect(chunk).not.toBeNull();
    expect(chunk?.type).toBe('content');
    expect(chunk?.content).toBe('Hello world');
    expect(chunk?.metadata?.session_id).toBe('abc-123');
  });

  test('converts tool_use event to chunk', () => {
    const event: ClaudeEvent = {
      type: 'tool_use',
      tool: 'calculator',
      input: { operation: 'add', a: 1, b: 2 },
      session_id: 'abc-123',
    };

    const chunk = eventToChunk(event);
    
    expect(chunk).not.toBeNull();
    expect(chunk?.type).toBe('tool_use');
    expect(chunk?.tool).toBe('calculator');
    expect(chunk?.content).toContain('"operation": "add"');
  });

  test('converts error event to chunk', () => {
    const event: ClaudeEvent = {
      type: 'error',
      error: 'Something went wrong',
      code: 'ERR_001',
      session_id: 'abc-123',
    };

    const chunk = eventToChunk(event);
    
    expect(chunk).not.toBeNull();
    expect(chunk?.type).toBe('error');
    expect(chunk?.content).toBe('Something went wrong');
    expect(chunk?.metadata?.code).toBe('ERR_001');
  });

  test('converts error result to error chunk', () => {
    const event: ClaudeEvent = {
      type: 'result',
      subtype: 'error',
      error: 'Task failed',
      cost_usd: 0.01,
      total_cost: 0.01,
      duration_ms: 1000,
      num_turns: 1,
      is_error: true,
      session_id: 'abc-123',
    };

    const chunk = eventToChunk(event);
    
    expect(chunk).not.toBeNull();
    expect(chunk?.type).toBe('error');
    expect(chunk?.content).toBe('Task failed');
  });

  test('returns null for system events', () => {
    const event: ClaudeEvent = {
      type: 'system',
      subtype: 'init',
      session_id: 'abc-123',
    };

    expect(eventToChunk(event)).toBeNull();
  });

  test('returns null for success results', () => {
    const event: ClaudeEvent = {
      type: 'result',
      subtype: 'success',
      cost_usd: 0.01,
      total_cost: 0.01,
      duration_ms: 1000,
      num_turns: 1,
      is_error: false,
      session_id: 'abc-123',
    };

    expect(eventToChunk(event)).toBeNull();
  });
});

describe('extractAssistantText', () => {
  test('extracts text from single content item', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content: [{ type: 'text', text: 'Hello world' }],
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    expect(extractAssistantText(event)).toBe('Hello world');
  });

  test('concatenates multiple text items', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'world' },
        ],
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    expect(extractAssistantText(event)).toBe('Hello world');
  });

  test('filters out non-text content', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content: [
          { type: 'text', text: 'Result: ' },
          // @ts-ignore - testing malformed content
          { type: 'image', url: 'image.png' },
          { type: 'text', text: '42' },
        ],
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    expect(extractAssistantText(event)).toBe('Result: 42');
  });

  test('returns empty string for empty content', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content: [],
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    expect(extractAssistantText(event)).toBe('');
  });

  test('handles missing content gracefully', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        // @ts-ignore - testing missing content
        content: null,
        stop_reason: 'end_turn',
      },
      session_id: 'abc-123',
    };

    expect(extractAssistantText(event)).toBe('');
  });
});

describe('extractSessionId', () => {
  test('extracts session ID from various event types', () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'session-1' },
      { 
        type: 'assistant', 
        message: { id: 'msg', type: 'message', role: 'assistant', model: 'claude', content: [], stop_reason: null },
        session_id: 'session-2' 
      },
      { type: 'result', subtype: 'success', cost_usd: 0, total_cost: 0, duration_ms: 0, num_turns: 1, is_error: false, session_id: 'session-3' },
    ];

    expect(extractSessionId(events[0])).toBe('session-1');
    expect(extractSessionId(events[1])).toBe('session-2');
    expect(extractSessionId(events[2])).toBe('session-3');
  });

  test('returns undefined for events without session ID', () => {
    const event: ClaudeEvent = {
      type: 'error',
      error: 'No session',
      // No session_id field
    };

    expect(extractSessionId(event)).toBeUndefined();
  });
});

describe('parseStreamEvents', () => {
  test('parses multiple valid lines', () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc-123"}',
      '{"type":"assistant","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Hi"}]},"session_id":"abc-123"}',
      '{"type":"result","subtype":"success","cost_usd":0.01,"total_cost":0.01,"duration_ms":1000,"num_turns":1,"is_error":false,"session_id":"abc-123"}',
    ];

    const events = parseStreamEvents(lines);
    
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('system');
    expect(events[1].type).toBe('assistant');
    expect(events[2].type).toBe('result');
  });

  test('filters out invalid lines', () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc-123"}',
      'invalid json',
      '',
      '{"no_type": "field"}',
      '{"type":"assistant","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude","content":[]},"session_id":"abc-123"}',
    ];

    const events = parseStreamEvents(lines);
    
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('system');
    expect(events[1].type).toBe('assistant');
  });
});

describe('isTerminalEvent', () => {
  test('identifies terminal events', () => {
    const resultEvent: ClaudeEvent = {
      type: 'result',
      subtype: 'success',
      cost_usd: 0,
      total_cost: 0,
      duration_ms: 0,
      num_turns: 1,
      is_error: false,
      session_id: 'abc',
    };

    const errorEvent: ClaudeEvent = {
      type: 'error',
      error: 'Failed',
    };

    expect(isTerminalEvent(resultEvent)).toBe(true);
    expect(isTerminalEvent(errorEvent)).toBe(true);
  });

  test('identifies non-terminal events', () => {
    const systemEvent: ClaudeEvent = {
      type: 'system',
      subtype: 'init',
      session_id: 'abc',
    };

    const assistantEvent: ClaudeEvent = {
      type: 'assistant',
      message: { id: 'msg', type: 'message', role: 'assistant', model: 'claude', content: [], stop_reason: null },
      session_id: 'abc',
    };

    expect(isTerminalEvent(systemEvent)).toBe(false);
    expect(isTerminalEvent(assistantEvent)).toBe(false);
  });
});