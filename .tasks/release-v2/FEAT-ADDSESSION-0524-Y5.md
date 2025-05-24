+++
id = "FEAT-ADDSESSION-0524-Y5"
title = "Add Session Metadata and Event Tracking to SDK"
type = "🌟 Feature"
status = "🟡 To Do"
priority = "🔼 High"
created_date = "2025-05-24"
updated_date = "2025-05-24"
assigned_to = "junior-dev"
phase = "release-v2"
tags = [ "sdk", "enhancement", "backward-compatible" ]
+++

# Add Session Metadata and Event Tracking to SDK

## Problem Statement

Currently, ChannelCoder throws away valuable metadata from Claude's responses, forcing developers to:
- Parse raw stdout themselves to extract session IDs for multi-turn conversations
- Manually track costs and API performance
- Use streaming mode even when they don't need it, just to see what tools Claude used
- Build their own JSON parsing layer on top of our SDK

This defeats the purpose of using an SDK - developers want to focus on their business logic, not on parsing Claude's output format.

## User Stories

1. **As a developer building a chat UI**, I need to continue conversations across page refreshes by storing and reusing session IDs.

2. **As a developer with budget constraints**, I need to track costs per session to implement spending limits and show users their usage.

3. **As a developer building an audit system**, I need to see what tools Claude used and what files it accessed for compliance logging.

4. **As a developer debugging issues**, I need to know when Claude hit the max turns limit vs other errors.

## Solution Overview

Enhance the SDK to parse Claude's JSON output and expose metadata that developers currently have to extract themselves. This will be done in a backward-compatible way that keeps the API simple for basic use cases while enabling advanced scenarios.

## Technical Design

### Claude's Output Format

When using `--output-format json`, Claude outputs newline-delimited JSON messages:

```json
{"type":"system","subtype":"init","session_id":"abc123","tools":["Read","Write"]}
{"type":"assistant","message":{...},"session_id":"abc123"}
{"type":"tool_use","tool":"Read","input":{"file":"src/index.ts"}}
{"type":"tool_result","tool":"Read","output":"file contents..."}
{"type":"result","subtype":"success","cost_usd":0.05,"duration_ms":5000,"duration_api_ms":4500,"num_turns":3,"result":"final answer","session_id":"abc123"}
```

### Enhanced CCResult Interface

```typescript
interface CCResult<T = any> {
  // Existing fields (unchanged)
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  warnings?: string[];
  
  // New: Core metadata from 'result' message
  metadata?: {
    sessionId: string;      // For conversation continuation
    cost: number;           // USD cost (from cost_usd)
    turns: number;          // Number of conversation turns
    duration: number;       // Total time in ms
    apiDuration: number;    // Time spent in API calls
    isMaxTurns: boolean;    // true if hit turn limit
  };
  
  // New: Optional event tracking
  events?: Array<
    | { type: 'content'; text: string; timestamp: number }
    | { type: 'tool_use'; tool: string; input: any; timestamp: number }
    | { type: 'tool_result'; tool: string; output: any; timestamp: number }
  >;
}
```

### API Usage Examples

```typescript
// Basic usage (unchanged)
const result = await cc.run("Analyze this code");
console.log(result.data); // Works exactly as before

// New: Access metadata
if (result.metadata) {
  console.log(`Cost: $${result.metadata.cost}`);
  console.log(`Session: ${result.metadata.sessionId}`);
}

// New: Continue conversation
const followUp = await cc.run("Add tests", {
  continueSession: result.metadata?.sessionId
});

// New: Track events (opt-in)
const detailed = await cc.run("Fix this bug", {
  includeEvents: true
});
detailed.events?.forEach(event => {
  if (event.type === 'tool_use') {
    console.log(`Claude used ${event.tool}`);
  }
});
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Update CCOptions interface** (`src/types.ts`)
   - Add `continueSession?: string` field
   - Add `includeEvents?: boolean` field (default: false)

2. **Create JSON parser** (`src/process.ts`)
   - Add `parseJsonMessages(output: string): ClaudeMessage[]` method
   - Handle malformed JSON gracefully
   - Filter empty lines

3. **Update execute method** (`src/process.ts`)
   - Replace current JSON extraction with new parser
   - Extract metadata from 'result' message
   - Map `continueSession` option to `--continue` CLI flag

### Phase 2: Metadata Extraction

4. **Extract metadata** (`src/process.ts`)
   - Find message with `type: 'result'`
   - Map fields: `session_id` → `sessionId`, `cost_usd` → `cost`, etc.
   - Set `isMaxTurns: true` when `subtype: 'error_max_turns'`

5. **Update error handling**
   - Preserve metadata even on errors
   - Detect max turns case and set appropriate error message

### Phase 3: Event Tracking

6. **Implement event extraction** (only when `includeEvents: true`)
   - Filter messages by type: 'assistant', 'tool_use', 'tool_result'
   - Transform to simplified event format
   - Add timestamps from processing order

7. **Update streaming mode**
   - Ensure streaming also populates metadata after completion
   - Keep consistent event format between modes

### Phase 4: Testing & Documentation

8. **Add comprehensive tests** (`test/process.test.ts`)
   - Test JSON parsing with various message combinations
   - Test metadata extraction
   - Test event tracking
   - Test continuation sessions
   - Test error cases (malformed JSON, max turns)

9. **Update documentation**
   - Add examples to README
   - Document metadata fields
   - Show continuation patterns
   - Explain event tracking

## Testing Checklist

- [ ] JSON parser handles malformed lines gracefully
- [ ] Metadata extracted correctly from result message
- [ ] Session continuation works with --continue flag
- [ ] Events captured when includeEvents is true
- [ ] Events not included when includeEvents is false/undefined
- [ ] Backward compatibility: existing code works unchanged
- [ ] Max turns error sets isMaxTurns flag
- [ ] Cost and duration fields properly converted
- [ ] Works in both streaming and non-streaming modes

## Success Criteria

1. **Zero breaking changes** - All existing code continues to work
2. **Type safety** - Full TypeScript types for metadata and events
3. **Performance** - No noticeable slowdown for basic usage
4. **Documentation** - Clear examples for each use case

## Code Example: JSON Parser Implementation

```typescript
// src/process.ts
private parseJsonMessages(output: string): any[] {
  return output
    .split('\n')
    .filter(line => line.trim()) // Skip empty lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        // Log but don't fail on malformed lines
        if (this.options.verbose) {
          console.error(`Failed to parse JSON line: ${line}`);
        }
        return null;
      }
    })
    .filter(Boolean); // Remove null entries
}

private extractMetadata(messages: any[]): CCResult['metadata'] | undefined {
  const resultMsg = messages.find(m => m.type === 'result');
  if (!resultMsg) return undefined;
  
  return {
    sessionId: resultMsg.session_id,
    cost: resultMsg.cost_usd,
    turns: resultMsg.num_turns,
    duration: resultMsg.duration_ms,
    apiDuration: resultMsg.duration_api_ms,
    isMaxTurns: resultMsg.subtype === 'error_max_turns'
  };
}
```

## Notes for Implementation

1. **Start simple** - Get metadata working first, then add events
2. **Preserve stdout** - Keep original stdout for debugging
3. **Fail gracefully** - If JSON parsing fails, fall back to current behavior
4. **Test with real Claude** - Mock tests are good, but verify with actual CLI

## Questions to Resolve

1. Should we normalize tool names? (e.g., "str_replace_editor" → "Edit")
2. Should events include system messages?
3. Should we add a `totalCost` field that accumulates across continued sessions?

## Dependencies

- No new npm dependencies needed
- Uses existing Zod for type definitions
- Compatible with current Node.js and Bun requirements
