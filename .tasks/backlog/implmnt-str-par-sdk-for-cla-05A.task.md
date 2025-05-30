# Implement Stream Parser SDK for Claude Log Processing

---
type: "\U0001F31F Feature"
status: To Do
area: core
priority: High
assignee: unassigned
tags:
  - parser
  - sdk
  - streaming
  - logs
---


## Instruction
## Context

ChannelCoder needs to expose its internal stream-json parsing capabilities to users. Currently, when using `detached` mode or `stream` output format, Claude produces newline-delimited JSON (NDJSON) where each line is a complete JSON object representing an event. This parsing logic is internal to the SDK, preventing users from:

1. Parsing detached session log files
2. Building custom monitoring tools
3. Synchronizing detached sessions with the session system
4. Analyzing costs and performance from logs

## Objective

Implement a composable, Unix-philosophy-inspired stream parser SDK that allows users to parse and process Claude's stream-json output from log files and real-time streams.

## Requirements

### Functional Requirements
1. Parse individual JSON events from Claude's stream-json format
2. Support both batch processing (complete files) and streaming (real-time)
3. Extract content, metadata, and session information from logs
4. Provide both high-level utilities and low-level building blocks
5. Enable session synchronization from detached logs

### Non-Functional Requirements
1. Zero dependencies on internal SDK classes (standalone)
2. Full TypeScript support with comprehensive types
3. Pure functions where possible (no side effects)
4. Compatible with Node.js streams and async iterables
5. Maintain backward compatibility with existing StreamChunk type

## Technical Design

See `/docs/stream-parser-sdk.md` for complete architecture.

### Core Components

1. **Type Definitions** (`src/stream-parser/types.ts`)
   - ClaudeEvent union type (SystemEvent, AssistantEvent, ResultEvent, etc.)
   - StreamChunk for backward compatibility
   - ParsedLog for file processing results

2. **Core Parsers** (`src/stream-parser/parser.ts`)
   - `parseStreamEvent(jsonLine: string): ClaudeEvent | null`
   - `eventToChunk(event: ClaudeEvent): StreamChunk | null`
   - `extractAssistantText(event: AssistantEvent): string`

3. **Stream Processing** (`src/stream-parser/stream.ts`)
   - `parseEventStream(lines: AsyncIterable<string>): AsyncIterable<ClaudeEvent>`
   - `eventsToChunks(events: AsyncIterable<ClaudeEvent>): AsyncIterable<StreamChunk>`
   - `extractContent(events: AsyncIterable<ClaudeEvent>): AsyncIterable<string>`

4. **File Operations** (`src/stream-parser/file.ts`)
   - `parseLogFile(logPath: string): Promise<ParsedLog>`
   - `readLogLines(logPath: string): AsyncIterable<string>`

5. **Monitoring** (`src/stream-parser/monitor.ts`)
   - `monitorLog(logPath: string, onEvent: (event) => void): () => void`
   - `createParserStream(): Transform`

## Implementation Steps

### Phase 1: Core Types and Parsers (Priority: High)
1. Create `src/stream-parser/types.ts` with all type definitions
2. Implement `src/stream-parser/parser.ts` with core parsing functions
3. Write comprehensive unit tests for parser functions
4. Handle edge cases: empty lines, invalid JSON, missing fields

### Phase 2: Stream Processing (Priority: High)
1. Create `src/stream-parser/stream.ts` with async generators
2. Implement transform utilities for event streams
3. Test with mock async iterables
4. Benchmark performance with large streams

### Phase 3: File Operations (Priority: Medium)
1. Implement `src/stream-parser/file.ts` with file parsing
2. Add streaming file reader for large logs
3. Create comprehensive ParsedLog result structure
4. Test with real Claude log files of various sizes

### Phase 4: Real-time Monitoring (Priority: Medium)
1. Create `src/stream-parser/monitor.ts` with tail-based monitoring
2. Implement Node.js Transform stream
3. Add proper cleanup and error handling
4. Test with actively growing log files

### Phase 5: Integration and Export (Priority: High)
1. Create `src/stream-parser/index.ts` to re-export all utilities
2. Update main `src/index.ts` with new exports
3. Add JSDoc comments to all exported functions
4. Update README with usage examples

### Phase 6: Session Integration (Priority: Low)
1. Create `src/stream-parser/session-sync.ts`
2. Design API for updating sessions from logs
3. Coordinate with session team on integration points
4. Add examples for session synchronization

## Testing Requirements

1. **Unit Tests**
   - Test each event type parsing
   - Test malformed JSON handling
   - Test chunk conversion logic
   - Test content extraction

2. **Integration Tests**
   - Parse complete log files
   - Stream processing with mock data
   - Real-time monitoring with timeouts
   - Large file performance tests

3. **Test Data**
   - Create sample log files for each scenario
   - Include edge cases: empty logs, truncated JSON
   - Multi-turn conversations
   - Logs with tool use

## Success Criteria

1. Users can parse detached session logs without internal SDK knowledge
2. All exported functions have TypeScript types and JSDoc
3. Zero breaking changes to existing SDK
4. Performance: Can process 1MB log file in < 100ms
5. Examples demonstrate all major use cases

## Dependencies

- Node.js built-in: fs, readline, stream, child_process
- No external npm dependencies
- TypeScript for development

## Risks and Mitigations

1. **Risk**: Log format changes in future Claude versions
   - **Mitigation**: Version-aware parsing, defensive coding

2. **Risk**: Performance issues with large logs
   - **Mitigation**: Streaming approach, benchmark early

3. **Risk**: Platform differences (Windows vs Unix)
   - **Mitigation**: Use Node.js APIs, avoid shell-specific features

## Tasks
- [ ] Create type definitions for all Claude event types
- [ ] Implement parseStreamEvent function with error handling
- [ ] Implement eventToChunk converter for backward compatibility
- [ ] Create async generator for streaming event parsing
- [ ] Implement parseLogFile for complete file processing
- [ ] Add real-time log monitoring with tail
- [ ] Create Node.js Transform stream for pipelines
- [ ] Write comprehensive unit tests
- [ ] Add integration tests with sample logs
- [ ] Update SDK exports in index.ts
- [ ] Write usage documentation
- [ ] Add examples to examples/ directory
- [ ] Test on Windows and macOS
- [ ] Benchmark performance with large files
- [ ] Create session synchronization utilities

## Deliverable
## Expected Deliverables

1. **Source Code**
   - `src/stream-parser/types.ts` - Type definitions
   - `src/stream-parser/parser.ts` - Core parsing functions
   - `src/stream-parser/stream.ts` - Stream processing utilities
   - `src/stream-parser/file.ts` - File operations
   - `src/stream-parser/monitor.ts` - Real-time monitoring
   - `src/stream-parser/index.ts` - Public API exports

2. **Tests**
   - `test/stream-parser/parser.test.ts`
   - `test/stream-parser/stream.test.ts`
   - `test/stream-parser/file.test.ts`
   - `test/stream-parser/monitor.test.ts`
   - Sample log files in `test/fixtures/`

3. **Documentation**
   - Updated README with parser section
   - JSDoc for all exported functions
   - Examples in `examples/parse-logs.ts`
   - Examples in `examples/monitor-detached.ts`

4. **Integration**
   - Exports added to main `src/index.ts`
   - No breaking changes to existing API
   - Types exported for user consumption

## Acceptance Criteria

- [ ] Can parse a detached session log and extract content
- [ ] Can monitor a log file in real-time
- [ ] All functions have TypeScript types
- [ ] Zero dependencies on CCProcess or other internals
- [ ] Examples demonstrate common use cases
- [ ] Tests pass on Node.js and Bun

## Log
## Log

### 2025-01-31 - Task Created
- Created comprehensive task specification
- Defined 6-phase implementation plan
- Based on design document: `/docs/stream-parser-sdk.md`
- Estimated effort: ~2-3 days for complete implementation
