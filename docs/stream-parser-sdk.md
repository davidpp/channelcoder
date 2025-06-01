# Stream Parser SDK Design

## Overview

This document defines the architecture for ChannelCoder's stream parsing utilities, enabling users to parse and process Claude's stream-json output from log files and real-time streams. The design follows Unix philosophy principles: small, composable functions that do one thing well.

## Background

When using `detached` mode or `stream` output format, Claude produces newline-delimited JSON (NDJSON) where each line is a complete JSON object representing an event. Currently, this parsing logic is internal to the SDK, preventing users from building their own tools for log analysis or session synchronization.

## Design Principles

1. **Single Responsibility**: Each function has one clear purpose
2. **Composable**: Functions work with standard JavaScript/Node.js primitives
3. **Pure Functions**: Core parsers have no side effects
4. **Progressive Disclosure**: Simple API for common cases, building blocks for advanced usage
5. **Type Safe**: Full TypeScript support with comprehensive types
6. **Zero Dependencies**: No reliance on internal SDK classes
7. **Stream-First**: Designed for both batch and real-time processing

## Core Types

```typescript
// Event types from Claude's stream-json format
export interface SystemEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
}

export interface AssistantEvent {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: Array<{ type: 'text'; text: string }>;
    stop_reason: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  session_id: string;
}

export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  cost_usd: number;
  total_cost: number;
  duration_ms: number;
  num_turns: number;
  result?: string;
  error?: string;
  session_id: string;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  input: any;
  session_id: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  output: any;
  session_id: string;
}

// Union of all event types
export type ClaudeEvent = 
  | SystemEvent 
  | AssistantEvent 
  | ResultEvent 
  | ToolUseEvent 
  | ToolResultEvent;

// Simplified chunk for backward compatibility
export interface StreamChunk {
  type: 'content' | 'error' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
  tool?: string;
  metadata?: Record<string, any>;
}

// Parsed log file result
export interface ParsedLog {
  events: ClaudeEvent[];
  chunks: StreamChunk[];
  sessionId?: string;
  content: string; // Concatenated assistant messages
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  metadata: {
    totalCost?: number;
    duration?: number;
    turns?: number;
  };
}
```

## Core API

### Level 1: Basic Parsing Functions

```typescript
// src/stream-parser.ts

/**
 * Parse a single JSON event from Claude's stream-json format
 * @param jsonLine - A single line containing a JSON object
 * @returns Parsed event or null if invalid
 */
export function parseStreamEvent(jsonLine: string): ClaudeEvent | null {
  if (!jsonLine.trim()) return null;
  
  try {
    const event = JSON.parse(jsonLine);
    
    // Validate event has required type field
    if (!event.type) return null;
    
    return event as ClaudeEvent;
  } catch {
    return null;
  }
}

/**
 * Convert a Claude event to a simplified StreamChunk
 * @param event - A parsed Claude event
 * @returns StreamChunk or null if not applicable
 */
export function eventToChunk(event: ClaudeEvent): StreamChunk | null {
  switch (event.type) {
    case 'assistant':
      const text = event.message.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');
      return {
        type: 'content',
        content: text,
        timestamp: Date.now(),
        metadata: { session_id: event.session_id }
      };
      
    case 'tool_use':
      return {
        type: 'tool_use',
        content: JSON.stringify(event.input),
        tool: event.tool,
        timestamp: Date.now()
      };
      
    case 'result':
      if (event.subtype === 'error' && event.error) {
        return {
          type: 'error',
          content: event.error,
          timestamp: Date.now()
        };
      }
      return null;
      
    default:
      return null;
  }
}

/**
 * Extract text content from an assistant event
 * @param event - An assistant event
 * @returns Concatenated text content
 */
export function extractAssistantText(event: AssistantEvent): string {
  return event.message.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');
}
```

### Level 2: Stream Processing

```typescript
/**
 * Transform a stream of JSON lines into parsed events
 * @param lines - Async iterable of JSON lines
 * @yields Parsed Claude events
 */
export async function* parseEventStream(
  lines: AsyncIterable<string>
): AsyncIterable<ClaudeEvent> {
  for await (const line of lines) {
    const event = parseStreamEvent(line);
    if (event) yield event;
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
    if (chunk) yield chunk;
  }
}

/**
 * Extract only content from events
 * @param events - Async iterable of Claude events
 * @yields Text content from assistant messages
 */
export async function* extractContent(
  events: AsyncIterable<ClaudeEvent>
): AsyncIterable<string> {
  for await (const event of events) {
    if (event.type === 'assistant') {
      const text = extractAssistantText(event);
      if (text) yield text;
    }
  }
}
```

### Level 3: File Processing

```typescript
// src/log-parser.ts

/**
 * Parse a complete log file
 * @param logPath - Path to the log file
 * @returns Structured representation of the log
 */
export async function parseLogFile(logPath: string): Promise<ParsedLog> {
  const content = await fs.readFile(logPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  
  const events: ClaudeEvent[] = [];
  const chunks: StreamChunk[] = [];
  const messages: ParsedLog['messages'] = [];
  
  let sessionId: string | undefined;
  let totalCost = 0;
  let duration = 0;
  let turns = 0;
  
  for (const line of lines) {
    const event = parseStreamEvent(line);
    if (!event) continue;
    
    events.push(event);
    
    // Extract metadata
    switch (event.type) {
      case 'system':
        sessionId = event.session_id;
        break;
        
      case 'assistant':
        const chunk = eventToChunk(event);
        if (chunk) chunks.push(chunk);
        
        messages.push({
          role: 'assistant',
          content: extractAssistantText(event),
          timestamp: Date.now()
        });
        break;
        
      case 'result':
        if (event.cost_usd) totalCost += event.cost_usd;
        if (event.duration_ms) duration = event.duration_ms;
        if (event.num_turns) turns = event.num_turns;
        break;
    }
  }
  
  return {
    events,
    chunks,
    sessionId,
    content: messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n'),
    messages,
    metadata: {
      totalCost,
      duration,
      turns
    }
  };
}

/**
 * Create a line-by-line reader for large files
 * @param logPath - Path to the log file
 * @yields Individual lines from the file
 */
export async function* readLogLines(logPath: string): AsyncIterable<string> {
  const stream = createReadStream(logPath);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    yield line;
  }
}
```

### Level 4: Real-time Monitoring

```typescript
// src/log-monitor.ts

/**
 * Monitor a log file for new events
 * @param logPath - Path to the log file
 * @param onEvent - Callback for each new event
 * @returns Cleanup function
 */
export function monitorLog(
  logPath: string,
  onEvent: (event: ClaudeEvent) => void
): () => void {
  const tail = spawn('tail', ['-f', logPath]);
  
  const rl = readline.createInterface({
    input: tail.stdout,
    crlfDelay: Infinity
  });
  
  rl.on('line', (line) => {
    const event = parseStreamEvent(line);
    if (event) onEvent(event);
  });
  
  return () => {
    rl.close();
    tail.kill();
  };
}

/**
 * Create a Node.js transform stream for parsing
 * @returns Transform stream that parses JSON lines to events
 */
export function createParserStream(): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      const line = chunk.toString();
      const event = parseStreamEvent(line);
      if (event) {
        this.push(event);
      }
      callback();
    }
  });
}
```

### Level 5: Session Integration

```typescript
// src/session-sync.ts

/**
 * Sync a session from a detached log file
 * @param session - Session instance to update
 * @param logPath - Path to the log file
 */
export async function syncSessionFromLog(
  session: Session,
  logPath: string
): Promise<void> {
  const parsed = await parseLogFile(logPath);
  
  if (parsed.sessionId && parsed.content) {
    // This would require a new method on Session
    // session.addAssistantMessage(parsed.content, parsed.sessionId);
  }
}

/**
 * Build a conversation history from events
 * @param events - Array of Claude events
 * @returns Conversation messages
 */
export function buildConversation(
  events: ClaudeEvent[]
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  
  for (const event of events) {
    if (event.type === 'assistant') {
      messages.push({
        role: 'assistant',
        content: extractAssistantText(event)
      });
    }
    // Note: User messages aren't in the log, would need session context
  }
  
  return messages;
}
```

## Usage Examples

### Basic: Parse a log file

```typescript
import { parseLogFile } from 'channelcoder/stream-parser';

const parsed = await parseLogFile('task-123.log');
console.log('Session ID:', parsed.sessionId);
console.log('Total Cost:', parsed.metadata.totalCost);
console.log('Assistant said:', parsed.content);
```

### Intermediate: Stream processing

```typescript
import { readLogLines, parseEventStream, extractContent } from 'channelcoder/stream-parser';

const lines = readLogLines('task-123.log');
const events = parseEventStream(lines);
const content = extractContent(events);

for await (const text of content) {
  console.log('Claude:', text);
}
```

### Advanced: Real-time monitoring

```typescript
import { monitorLog, eventToChunk } from 'channelcoder/stream-parser';

const cleanup = monitorLog('task-123.log', (event) => {
  if (event.type === 'assistant') {
    console.log('New message:', extractAssistantText(event));
  } else if (event.type === 'result') {
    console.log('Task complete! Cost:', event.cost_usd);
  }
});

// Later...
cleanup();
```

### Expert: Custom processing pipeline

```typescript
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createParserStream } from 'channelcoder/stream-parser';

await pipeline(
  createReadStream('task-123.log'),
  split2(), // Split by newlines (from split2 package)
  createParserStream(),
  new Transform({
    objectMode: true,
    transform(event, encoding, callback) {
      // Custom processing
      if (event.type === 'assistant') {
        this.push({
          timestamp: Date.now(),
          text: extractAssistantText(event)
        });
      }
      callback();
    }
  }),
  createWriteStream('processed.jsonl')
);
```

## Export Strategy

```typescript
// src/index.ts (additions)

// High-level utilities
export { 
  parseLogFile, 
  syncSessionFromLog 
} from './stream-parser/index.js';

// Building blocks for advanced users
export * as streamParser from './stream-parser/index.js';

// Types always exported
export type {
  ClaudeEvent,
  SystemEvent,
  AssistantEvent,
  ResultEvent,
  ToolUseEvent,
  ToolResultEvent,
  StreamChunk,
  ParsedLog
} from './stream-parser/types.js';
```

## Implementation Plan

1. **Phase 1: Core Parsing**
   - Implement type definitions
   - Create `parseStreamEvent` and `eventToChunk`
   - Add unit tests for various event types

2. **Phase 2: Stream Processing**
   - Implement async generators
   - Create transform utilities
   - Test with large files

3. **Phase 3: File Operations**
   - Implement `parseLogFile`
   - Add streaming file reader
   - Handle edge cases (empty files, corrupted JSON)

4. **Phase 4: Monitoring**
   - Create real-time monitoring utilities
   - Add Node.js stream support
   - Test with active log files

5. **Phase 5: Integration**
   - Export from main SDK
   - Update documentation
   - Add examples to README

## Testing Strategy

1. Unit tests for each parser function
2. Integration tests with sample log files
3. Stream processing tests with mock data
4. Real-time monitoring tests (with timeouts)
5. Error handling tests (corrupted JSON, missing fields)

## Future Enhancements

1. **Binary format support** - More efficient than JSON for large logs
2. **Compression support** - Handle gzipped log files
3. **Filtering utilities** - Extract specific event types
4. **Analytics functions** - Cost analysis, timing metrics
5. **Session reconstruction** - Rebuild full conversation from logs