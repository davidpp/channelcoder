import { describe, expect, test } from 'bun:test';
import {
  parseEventStream,
  eventsToChunks,
  extractContent,
  filterEventType,
  bufferUntilComplete,
  parseEventStreamSafe,
  compose,
  collect,
  take,
  fromArray,
} from '../../src/stream-parser/stream.js';
import type { ClaudeEvent } from '../../src/stream-parser/types.js';

// Helper to create async iterable from array
async function* asyncLines(lines: string[]): AsyncIterable<string> {
  for (const line of lines) {
    yield line;
  }
}

// Helper to create async iterable from events
async function* asyncEvents(events: ClaudeEvent[]): AsyncIterable<ClaudeEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('parseEventStream', () => {
  test('parses stream of valid JSON lines', async () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc-123"}',
      '{"type":"assistant","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Hello"}]},"session_id":"abc-123"}',
      '{"type":"result","subtype":"success","cost_usd":0.01,"total_cost":0.01,"duration_ms":1000,"num_turns":1,"is_error":false,"session_id":"abc-123"}',
    ];

    const events = await collect(parseEventStream(asyncLines(lines)));
    
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('system');
    expect(events[1].type).toBe('assistant');
    expect(events[2].type).toBe('result');
  });

  test('filters out invalid lines', async () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc"}',
      'invalid json',
      '',
      '{"type":"assistant","message":{"id":"msg","type":"message","role":"assistant","model":"claude","content":[]},"session_id":"abc"}',
    ];

    const events = await collect(parseEventStream(asyncLines(lines)));
    
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('system');
    expect(events[1].type).toBe('assistant');
  });
});

describe('eventsToChunks', () => {
  test('converts assistant events to chunks', async () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [{ type: 'text', text: 'Hello' }],
          stop_reason: 'end_turn',
        },
        session_id: 'abc',
      },
      {
        type: 'result',
        subtype: 'success',
        cost_usd: 0.01,
        total_cost: 0.01,
        duration_ms: 1000,
        num_turns: 1,
        is_error: false,
        session_id: 'abc',
      },
    ];

    const chunks = await collect(eventsToChunks(asyncEvents(events)));
    
    // Only assistant event converts to chunk
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('content');
    expect(chunks[0].content).toBe('Hello');
  });
});

describe('extractContent', () => {
  test('extracts only assistant text content', async () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [{ type: 'text', text: 'First message' }],
          stop_reason: 'end_turn',
        },
        session_id: 'abc',
      },
      { type: 'tool_use', tool: 'calculator', input: {}, session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [{ type: 'text', text: 'Second message' }],
          stop_reason: 'end_turn',
        },
        session_id: 'abc',
      },
    ];

    const content = await collect(extractContent(asyncEvents(events)));
    
    expect(content).toHaveLength(2);
    expect(content[0]).toBe('First message');
    expect(content[1]).toBe('Second message');
  });
});

describe('filterEventType', () => {
  test('filters events by type', async () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [],
          stop_reason: null,
        },
        session_id: 'abc',
      },
      { type: 'tool_use', tool: 'calc', input: {}, session_id: 'abc' },
      { type: 'tool_result', tool: 'calc', output: '42', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [],
          stop_reason: null,
        },
        session_id: 'abc',
      },
    ];

    const assistantEvents = await collect(filterEventType(asyncEvents(events), 'assistant'));
    
    expect(assistantEvents).toHaveLength(2);
    expect(assistantEvents.every(e => e.type === 'assistant')).toBe(true);
  });
});

describe('bufferUntilComplete', () => {
  test('buffers events until terminal event', async () => {
    const events: ClaudeEvent[] = [
      // First conversation
      { type: 'system', subtype: 'init', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [],
          stop_reason: null,
        },
        session_id: 'abc',
      },
      {
        type: 'result',
        subtype: 'success',
        cost_usd: 0.01,
        total_cost: 0.01,
        duration_ms: 1000,
        num_turns: 1,
        is_error: false,
        session_id: 'abc',
      },
      // Second conversation
      { type: 'system', subtype: 'init', session_id: 'def' },
      { type: 'error', error: 'Failed', session_id: 'def' },
    ];

    const conversations = await collect(bufferUntilComplete(asyncEvents(events)));
    
    expect(conversations).toHaveLength(2);
    expect(conversations[0]).toHaveLength(3);
    expect(conversations[1]).toHaveLength(2);
    expect(conversations[0][2].type).toBe('result');
    expect(conversations[1][1].type).toBe('error');
  });

  test('yields remaining events if no terminal', async () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'abc' },
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude',
          content: [],
          stop_reason: null,
        },
        session_id: 'abc',
      },
    ];

    const conversations = await collect(bufferUntilComplete(asyncEvents(events)));
    
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toHaveLength(2);
  });
});

describe('parseEventStreamSafe', () => {
  test('continues on parse errors', async () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc"}',
      'invalid json that will throw',
      '{"type":"assistant","message":{"id":"msg","type":"message","role":"assistant","model":"claude","content":[]},"session_id":"abc"}',
    ];

    const errors: Array<{ error: Error; line: string }> = [];
    const events = await collect(
      parseEventStreamSafe(asyncLines(lines), (error, line) => {
        errors.push({ error, line });
      })
    );
    
    expect(events).toHaveLength(2);
    expect(errors).toHaveLength(0); // parseStreamEvent returns null, doesn't throw
  });
});

describe('compose', () => {
  test('composes multiple transformations', async () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"abc"}',
      '{"type":"assistant","message":{"id":"msg","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Hello"}]},"session_id":"abc"}',
      '{"type":"result","subtype":"success","cost_usd":0.01,"total_cost":0.01,"duration_ms":1000,"num_turns":1,"is_error":false,"session_id":"abc"}',
    ];

    const content = await collect(
      compose(
        asyncLines(lines),
        parseEventStream,
        extractContent
      )
    );
    
    expect(content).toHaveLength(1);
    expect(content[0]).toBe('Hello');
  });
});

describe('take', () => {
  test('takes only specified number of items', async () => {
    const items = [1, 2, 3, 4, 5];
    const taken = await collect(take(fromArray(items), 3));
    
    expect(taken).toEqual([1, 2, 3]);
  });

  test('handles taking more than available', async () => {
    const items = [1, 2];
    const taken = await collect(take(fromArray(items), 5));
    
    expect(taken).toEqual([1, 2]);
  });
});