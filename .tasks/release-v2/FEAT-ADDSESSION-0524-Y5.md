+++
id = "FEAT-ADDSESSION-0524-Y5"
title = "Add Session Metadata and Event Tracking to SDK"
type = "🌟 Feature"
status = "🟡 To Do"
priority = "🔼 High"
created_date = "2025-05-24"
updated_date = "2025-05-25"
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

## Important: Claude Session Behavior

Based on testing Claude CLI v1.0.3, we discovered important session behaviors:

### Key Findings

1. **New Session ID on Resume**: When using `--resume <session-id>`, Claude creates a NEW session ID for each continuation, not reusing the original.

2. **No Conversation History**: Claude does NOT return previous messages in any output format:
   - Not in `--output-format json`
   - Not in `--output-format stream-json`
   - Not even with `--verbose`

3. **Context is Maintained**: Despite new session IDs, Claude remembers the conversation context (can recall previous information).

4. **Cumulative Metrics**: Turn count and costs accumulate across resumed sessions.

5. **No User Messages in Output**: Even the current user prompt is not included in the output.

### Implications

- Developers MUST store conversation history themselves if they need it
- The original session ID must be preserved for continuation (not the new ones)
- Multi-thread UIs need their own message storage solution
- We cannot provide conversation history - only current turn data

## Technical Design

### Claude's Output Format

When using `--output-format json`, Claude outputs a single line:
```json
{"type":"result","subtype":"success","cost_usd":0.05,"duration_ms":5000,"duration_api_ms":4500,"num_turns":3,"result":"final answer","total_cost":0.05,"session_id":"abc123"}
```

With `--output-format stream-json --verbose`:
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
    sessionId: string;      // NEW session ID (changes each resume!)
    cost: number;           // This turn's cost (from cost_usd)
    totalCost: number;      // Cumulative cost (from total_cost)
    turns: number;          // Cumulative conversation turns
    duration: number;       // Total time in ms
    apiDuration: number;    // Time spent in API calls
    isMaxTurns: boolean;    // true if hit turn limit
  };
  
  // New: Optional event tracking (current turn only)
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
  // Store this sessionId for your records, but...
}

// New: Continue conversation
// IMPORTANT: Use the ORIGINAL session ID, not the one from the last response!
const firstResult = await cc.run("Remember BANANA");
const originalSessionId = firstResult.metadata?.sessionId;

// Store firstResult in your app's conversation history

const followUp = await cc.run("What did I ask you to remember?", {
  resume: originalSessionId  // Use the first session ID
});
// followUp.metadata.sessionId will be DIFFERENT but context is maintained
// followUp.metadata.turns will be 3 (cumulative)

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
   - Add `includeEvents?: boolean` field (default: false)
   - Note: `resume?: string` already exists!

2. **Create JSON parser** (`src/process.ts`)
   - Add `parseJsonMessages(output: string): ClaudeMessage[]` method
   - Handle both single-line JSON and stream-json formats
   - Handle malformed JSON gracefully

3. **Update execute method** (`src/process.ts`)
   - Replace current JSON extraction with new parser
   - Extract metadata from 'result' message
   - Ensure `resume` option continues to map to `--resume` flag

### Phase 2: Metadata Extraction

4. **Extract metadata** (`src/process.ts`)
   - Find message with `type: 'result'`
   - Map fields correctly:
     - `session_id` → `sessionId`
     - `cost_usd` → `cost`
     - `total_cost` → `totalCost` (cumulative)
     - `num_turns` → `turns` (cumulative)
   - Set `isMaxTurns: true` when `subtype: 'error_max_turns'`

5. **Update error handling**
   - Preserve metadata even on errors
   - Detect max turns case and set appropriate error message

### Phase 3: Event Tracking

6. **Implement event extraction** (only when `includeEvents: true`)
   - Only extract from CURRENT turn (no history available)
   - Filter messages by type: 'assistant', 'tool_use', 'tool_result'
   - Transform to simplified event format
   - Add timestamps from processing order

7. **Update streaming mode**
   - Ensure streaming also populates metadata after completion
   - Keep consistent event format between modes

### Phase 4: Testing & Documentation

8. **Add comprehensive tests** (`test/process.test.ts`)
   - Test JSON parsing with various message formats
   - Test metadata extraction
   - Test event tracking (current turn only)
   - Test session continuation behavior
   - Test that new session IDs are properly extracted
   - Test error cases (malformed JSON, max turns)

9. **Update documentation**
   - Add examples to README
   - Document metadata fields
   - **Clearly explain session ID behavior**
   - **Emphasize that conversation history is NOT provided**
   - Show patterns for managing conversation storage

## Testing Checklist

- [ ] JSON parser handles malformed lines gracefully
- [ ] Metadata extracted correctly from result message
- [ ] Session continuation works with existing resume option
- [ ] New session IDs are properly captured on resume
- [ ] Cumulative metrics (turns, totalCost) are correct
- [ ] Events captured when includeEvents is true (current turn only)
- [ ] Events not included when includeEvents is false/undefined
- [ ] Backward compatibility: existing code works unchanged
- [ ] Max turns error sets isMaxTurns flag
- [ ] Cost and duration fields properly converted
- [ ] Works in both streaming and non-streaming modes

## Success Criteria

1. **Zero breaking changes** - All existing code continues to work
2. **Type safety** - Full TypeScript types for metadata and events
3. **Performance** - No noticeable slowdown for basic usage
4. **Clear documentation** - Especially about session behavior
5. **Honest API** - Don't hide Claude's actual behavior

## What This Does NOT Provide

1. **Conversation History** - Developers must store messages themselves
2. **Session Management** - Just exposes the data, no state management
3. **Message Threading** - That's application-level concern
4. **Persistent Sessions** - Sessions are ephemeral in Claude

## Important Notes: Session Storage Reality

### Claude Sessions are NOT Server Sessions

Claude's sessions are **local file-based** and tied to:
- **User**: Each system user has their own session storage
- **Folder**: Sessions are stored in the user's home directory
- **Machine**: Sessions don't sync across machines

### This Breaks in Common Development Scenarios

1. **Git Worktrees**: Each worktree runs in a different directory - sessions won't carry over
2. **Docker/Containers**: Each container has its own filesystem - sessions are isolated
3. **Multiple Developers**: Each developer has their own home directory - sessions aren't shared
4. **CI/CD Pipelines**: Each run is a fresh environment - no session persistence
5. **Remote Development**: SSH sessions, Codespaces, etc. have separate session storage

### Documentation Must Warn Developers

We need to clearly document that:
- Sessions are ephemeral and local to the machine/user/environment
- Don't rely on session persistence across development environments
- For production use, implement your own session storage
- Test session handling in your actual deployment environment
- Consider sessions as "best effort" continuity, not guaranteed state

### SDK Design Implications

- We expose session IDs but make no guarantees about their availability
- Error handling should gracefully handle "session not found" scenarios
- Documentation should emphasize building robust apps that work without sessions
- Examples should show both with-session and without-session patterns

### Session Storage Location (Internal)

**Note for Testing/Debugging**: Claude stores session data in `~/.claude/projects/{uuid}.jsonl` files. While the SDK will NOT read these files (to avoid coupling to Claude's internal implementation), this information is useful for:
- Internal testing and validation
- Debugging session continuity issues
- Understanding what data Claude maintains

⚠️ **Warning**: This is Claude's internal storage format and location, which may change without notice. Do not build production features that depend on reading these files.

## Code Example: Metadata Extraction

```typescript
// src/process.ts
private extractMetadata(output: string): CCResult['metadata'] | undefined {
  let messages: any[];
  
  // Handle different output formats
  if (this.options.outputFormat === 'stream-json') {
    messages = output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } else {
    // Single JSON line for regular json format
    try {
      messages = [JSON.parse(output.trim())];
    } catch {
      return undefined;
    }
  }
  
  const resultMsg = messages.find(m => m.type === 'result');
  if (!resultMsg) return undefined;
  
  return {
    sessionId: resultMsg.session_id,  // This will be NEW on resume!
    cost: resultMsg.cost_usd,
    totalCost: resultMsg.total_cost || resultMsg.cost_usd,
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
3. **Document session behavior clearly** - Many developers will be surprised
4. **Test with real Claude** - Mock tests are good, but verify actual behavior
5. **Don't try to "fix" Claude's session behavior** - Just expose it honestly

## Questions Resolved

1. ~~Should we normalize tool names?~~ → Keep as-is from Claude
2. ~~Should events include system messages?~~ → No, follow Claude's output
3. ~~Should we add a `totalCost` field?~~ → Yes, it's in Claude's output as `total_cost`

## Dependencies

- No new npm dependencies needed
- Uses existing Zod for type definitions
- Compatible with current Node.js and Bun requirements
