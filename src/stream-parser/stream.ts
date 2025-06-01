/**
 * Stream processing utilities for async iterables
 */

import { eventToChunk, extractAssistantText, parseStreamEvent } from './parser.js';
import type { ClaudeEvent, StreamChunk } from './types.js';
import { isAssistantEvent } from './types.js';

/**
 * Transform a stream of JSON lines into parsed events
 * @param lines - Async iterable of JSON lines
 * @yields Parsed Claude events
 */
export async function* parseEventStream(lines: AsyncIterable<string>): AsyncIterable<ClaudeEvent> {
  for await (const line of lines) {
    const event = parseStreamEvent(line);
    if (event) {
      yield event;
    }
  }
}

/**
 * Transform events into simplified chunks
 * @param events - Async iterable of Claude events
 * @yields Stream chunks
 */
export async function* eventsToChunks(
  events: AsyncIterable<ClaudeEvent>
): AsyncIterable<StreamChunk> {
  for await (const event of events) {
    const chunk = eventToChunk(event);
    if (chunk) {
      yield chunk;
    }
  }
}

/**
 * Extract only content from events
 * @param events - Async iterable of Claude events
 * @yields Text content from assistant messages
 */
export async function* extractContent(events: AsyncIterable<ClaudeEvent>): AsyncIterable<string> {
  for await (const event of events) {
    if (isAssistantEvent(event)) {
      const text = extractAssistantText(event);
      if (text) {
        yield text;
      }
    }
  }
}

/**
 * Extract only events of a specific type
 * @param events - Async iterable of Claude events
 * @param type - Event type to filter for
 * @yields Events of the specified type
 */
export async function* filterEventType<T extends ClaudeEvent['type']>(
  events: AsyncIterable<ClaudeEvent>,
  type: T
): AsyncIterable<Extract<ClaudeEvent, { type: T }>> {
  for await (const event of events) {
    if (event.type === type) {
      yield event as Extract<ClaudeEvent, { type: T }>;
    }
  }
}

/**
 * Buffer events until a terminal event is received
 * @param events - Async iterable of Claude events
 * @yields Arrays of events representing complete conversations
 */
export async function* bufferUntilComplete(
  events: AsyncIterable<ClaudeEvent>
): AsyncIterable<ClaudeEvent[]> {
  let buffer: ClaudeEvent[] = [];

  for await (const event of events) {
    buffer.push(event);

    // Check if this is a terminal event
    if (event.type === 'result' || event.type === 'error') {
      yield buffer;
      buffer = [];
    }
  }

  // Yield any remaining events
  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Transform a stream with error handling
 * @param lines - Async iterable of JSON lines
 * @param onError - Error handler callback
 * @yields Successfully parsed events
 */
export async function* parseEventStreamSafe(
  lines: AsyncIterable<string>,
  onError?: (error: Error, line: string) => void
): AsyncIterable<ClaudeEvent> {
  for await (const line of lines) {
    try {
      const event = parseStreamEvent(line);
      if (event) {
        yield event;
      }
    } catch (error) {
      if (onError) {
        onError(error as Error, line);
      }
      // Continue processing
    }
  }
}

/**
 * Compose multiple stream transformations
 * @param source - Source async iterable
 * @param transforms - Array of transform functions
 * @returns Transformed async iterable
 */
export async function* compose<T, R>(
  source: AsyncIterable<T>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic transform pipeline needs flexible typing
  ...transforms: Array<(input: AsyncIterable<any>) => AsyncIterable<any>>
): AsyncIterable<R> {
  // biome-ignore lint/suspicious/noExplicitAny: Result type evolves through transform pipeline
  let result: AsyncIterable<any> = source;

  for (const transform of transforms) {
    result = transform(result);
  }

  yield* result as AsyncIterable<R>;
}

/**
 * Collect all items from an async iterable into an array
 * @param iterable - Async iterable to collect
 * @returns Array of all items
 */
export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Take only the first N items from an async iterable
 * @param iterable - Source async iterable
 * @param count - Number of items to take
 * @yields Up to count items
 */
export async function* take<T>(iterable: AsyncIterable<T>, count: number): AsyncIterable<T> {
  let taken = 0;
  for await (const item of iterable) {
    if (taken >= count) break;
    yield item;
    taken++;
  }
}

/**
 * Create an async iterable from an array
 * @param items - Array of items
 * @yields Items from the array
 */
export async function* fromArray<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}
