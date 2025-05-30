/**
 * Stream Parser SDK for Claude's stream-json format
 * 
 * This module provides utilities for parsing and processing Claude's
 * newline-delimited JSON (NDJSON) output from log files and streams.
 */

// Re-export all types
export * from './types.js';

// Re-export parser functions
export {
  parseStreamEvent,
  eventToChunk,
  extractAssistantText,
  extractSessionId,
  parseStreamEvents,
  isTerminalEvent,
} from './parser.js';

// Re-export stream processing utilities
export {
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
} from './stream.js';

// Re-export file operations
export {
  parseLogFile,
  readLogLines,
  parseLogStream,
  getLogSummary,
  isValidLogFile,
} from './file.js';

// Re-export monitoring utilities
export {
  monitorLog,
  createParserStream,
  createChunkStream,
  monitorMultipleLogs,
  createAsyncMonitor,
  type MonitorOptions,
} from './monitor.js';

// High-level convenience exports for common use cases
export { parseLogFile as parse } from './file.js';
export { monitorLog as monitor } from './monitor.js';