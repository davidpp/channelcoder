# Task Monitor TUI Example

This example demonstrates using the ChannelCoder Stream Parser SDK to build a real-time terminal user interface (TUI) for monitoring Claude sessions.

## Features

- **Real-time Log Monitoring**: Uses the Stream Parser SDK's `monitorLog` function to parse Claude's stream-json output in real-time
- **Rich Event Processing**: Extracts and displays:
  - Session ID
  - Model being used
  - Tools that have been called
  - Total cost of the conversation
  - Number of events processed
- **Interactive Feedback**: Detects when Claude is asking for feedback and allows continuing the conversation
- **Clean UI**: Terminal-based interface with color coding and status indicators

## How It Works

1. **Detached Sessions**: Tasks run in detached mode, writing to log files
2. **Real-time Monitoring**: The Stream Parser SDK monitors the log file using:
   - Platform-specific tail commands (Unix) or file watching (Windows)
   - NDJSON parsing for each event
   - Event-driven updates to the UI
3. **Event Processing**: Each Claude event is processed to:
   - Update task status
   - Extract content for display
   - Track tool usage
   - Detect completion or errors

## Usage

```bash
bun run examples/task-monitor-tui.ts
```

### Commands

- **Type any text** - Start a new task with the given prompt
- **/continue <feedback>** - Continue a task that's waiting for feedback
- **/status** - Refresh the display
- **/logs** - Show recent raw events (for debugging)
- **/stop** - Stop the current task
- **/quit** - Exit the TUI

### Example Prompts

1. `TEST: Calculate 2+2 and then ask if you should continue`
   - Demonstrates feedback detection and continuation

2. `TEST: List 3 colors, then ask which one to explain`
   - Shows interactive conversation flow

3. `TEST: Say hello and immediately finish`
   - Simple task that completes quickly

## Code Highlights

### Real-time Event Processing
```typescript
// Process each event as it arrives
function processEvent(event: ClaudeEvent) {
  // Extract session ID
  const sessionId = streamParser.extractSessionId(event);
  
  // Convert to chunk for display
  const chunk = streamParser.eventToChunk(event);
  
  // Track tool usage
  if (streamParser.isToolUseEvent(event)) {
    currentTask.toolsUsed.add(event.tool);
  }
  
  // Update status based on event type
  if (streamParser.isResultEvent(event)) {
    currentTask.status = event.subtype === 'error' ? 'error' : 'completed';
    currentTask.totalCost = event.total_cost;
  }
}
```

### Monitoring Setup
```typescript
// Start real-time monitoring
const cleanup = monitorLog(currentTask.logFile, processEvent, {
  onError: (error) => {
    currentTask.status = 'error';
    currentTask.outputBuffer.push(`❌ Monitor error: ${error.message}`);
  }
});

// Store cleanup function for later
currentTask.monitor = cleanup;
```

## Benefits of Stream Parser SDK

1. **No Manual Parsing**: The SDK handles all NDJSON parsing and event typing
2. **Type Safety**: Full TypeScript types for all Claude events
3. **Cross-platform**: Works on Unix, macOS, and Windows
4. **Memory Efficient**: Streams events instead of loading entire files
5. **Real-time Updates**: Get events as they're written to the log

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude CLI     │────▶│  Log File    │────▶│  Monitor    │
│  (detached)     │     │  (NDJSON)    │     │  (tail/fs)  │
└─────────────────┘     └──────────────┘     └─────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │ parseEvent  │
                                              │ eventToChunk│
                                              └─────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │    TUI      │
                                              │  Display    │
                                              └─────────────┘
```

This example showcases how the Stream Parser SDK simplifies building sophisticated monitoring tools for Claude sessions.