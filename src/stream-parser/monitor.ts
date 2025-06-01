/**
 * Real-time log monitoring utilities
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { type FSWatcher, watch } from 'node:fs';
import * as readline from 'node:readline';
import { type Readable, Transform } from 'node:stream';
import { parseStreamEvent } from './parser.js';
import type { ClaudeEvent } from './types.js';

/**
 * Options for monitoring a log file
 */
export interface MonitorOptions {
  /**
   * Use file watching instead of tail (for environments without tail)
   */
  useWatch?: boolean;

  /**
   * Initial number of lines to read when starting
   */
  initialLines?: number;

  /**
   * Debounce file change events (ms)
   */
  debounceMs?: number;
}

/**
 * Monitor a log file for new events
 * @param logPath - Path to the log file
 * @param onEvent - Callback for each new event
 * @param options - Monitoring options
 * @returns Cleanup function
 */
export function monitorLog(
  logPath: string,
  onEvent: (event: ClaudeEvent) => void,
  options: MonitorOptions = {}
): () => void {
  const { useWatch = false, initialLines = 0 } = options;

  let cleanup: () => void;

  if (useWatch) {
    cleanup = monitorWithWatch(logPath, onEvent, options);
  } else {
    cleanup = monitorWithTail(logPath, onEvent, initialLines);
  }

  return cleanup;
}

/**
 * Monitor using tail command (Unix-like systems)
 */
function monitorWithTail(
  logPath: string,
  onEvent: (event: ClaudeEvent) => void,
  initialLines: number
): () => void {
  const args = ['-f'];

  // Add initial lines to read
  if (initialLines > 0) {
    args.push('-n', String(initialLines));
  }

  args.push(logPath);

  const tail = spawn('tail', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({
    input: tail.stdout as Readable,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  rl.on('line', (line) => {
    const event = parseStreamEvent(line);
    if (event) {
      onEvent(event);
    }
  });

  // Handle errors
  tail.stderr?.on('data', (data) => {
    console.error('Tail error:', data.toString());
  });

  tail.on('error', (error) => {
    console.error('Failed to spawn tail:', error);
  });

  // Cleanup function
  return () => {
    rl.close();
    tail.kill();
  };
}

/**
 * Monitor using file watching (cross-platform)
 */
function monitorWithWatch(
  logPath: string,
  _onEvent: (event: ClaudeEvent) => void,
  options: MonitorOptions
): () => void {
  const { debounceMs = 100 } = options;

  const _lastSize = 0;
  let debounceTimer: Timer | null = null;

  const watcher = watch(logPath, (eventType) => {
    if (eventType === 'change') {
      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        // Read new content from file
        // This is a simplified implementation
        // A production version would track file position
        console.warn('File watching mode is simplified - use tail mode for production');
      }, debounceMs);
    }
  });

  watcher.on('error', (error) => {
    console.error('Watch error:', error);
  });

  // Cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    watcher.close();
  };
}

/**
 * Create a Node.js transform stream for parsing
 * @returns Transform stream that parses JSON lines to events
 */
export function createParserStream(): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      // Handle both string and buffer input
      const line = chunk.toString().trim();

      if (line) {
        const event = parseStreamEvent(line);
        if (event) {
          this.push(event);
        }
      }

      callback();
    },
  });
}

/**
 * Create a transform stream that converts events to chunks
 * @returns Transform stream
 */
export function createChunkStream(): Transform {
  return new Transform({
    objectMode: true,
    transform(event: ClaudeEvent, _encoding, callback) {
      // Import inside to avoid circular dependency
      import('./parser.js')
        .then(({ eventToChunk }) => {
          const chunk = eventToChunk(event);
          if (chunk) {
            this.push(chunk);
          }
          callback();
        })
        .catch(callback);
    },
  });
}

/**
 * Monitor multiple log files simultaneously
 * @param logPaths - Array of log file paths
 * @param onEvent - Callback with log path and event
 * @param options - Monitoring options
 * @returns Cleanup function
 */
export function monitorMultipleLogs(
  logPaths: string[],
  onEvent: (logPath: string, event: ClaudeEvent) => void,
  options: MonitorOptions = {}
): () => void {
  const cleanups = logPaths.map((logPath) =>
    monitorLog(logPath, (event) => onEvent(logPath, event), options)
  );

  // Return combined cleanup
  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

/**
 * Create a log monitor that emits events through an async iterable
 * @param logPath - Path to the log file
 * @param options - Monitoring options
 * @returns Object with async iterable and cleanup function
 */
export function createAsyncMonitor(
  logPath: string,
  options: MonitorOptions = {}
): {
  events: AsyncIterable<ClaudeEvent>;
  cleanup: () => void;
} {
  const events: ClaudeEvent[] = [];
  const waiters: Array<(value: IteratorResult<ClaudeEvent>) => void> = [];
  let done = false;

  const cleanup = monitorLog(
    logPath,
    (event) => {
      if (waiters.length > 0) {
        const waiter = waiters.shift()!;
        waiter({ value: event, done: false });
      } else {
        events.push(event);
      }
    },
    options
  );

  const asyncIterable: AsyncIterable<ClaudeEvent> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<ClaudeEvent>> {
          if (done) {
            return { done: true, value: undefined };
          }

          if (events.length > 0) {
            const event = events.shift()!;
            return { value: event, done: false };
          }

          // Wait for next event
          return new Promise((resolve) => {
            waiters.push(resolve);
          });
        },

        async return(): Promise<IteratorResult<ClaudeEvent>> {
          done = true;
          cleanup();
          return { done: true, value: undefined };
        },
      };
    },
  };

  return {
    events: asyncIterable,
    cleanup: () => {
      done = true;
      cleanup();
      // Resolve any waiting promises
      waiters.forEach((waiter) => waiter({ done: true, value: undefined }));
    },
  };
}
