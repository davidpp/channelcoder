# Session ID Management in Detached Mode - Brainstorming

## Problem Statement

In detached mode, we cannot capture Claude's session IDs from the stream in real-time, making it difficult to resume/continue sessions later. We need a reliable way to maintain session continuity across detached executions.

## Current State

- **Session Storage**: Tracks our state + message history, stores final session ID
- **Detached Mode**: Writes to log file, but we don't process the stream
- **Claude's Behavior**: Creates JSONL logs in `~/.claude/logs/conversations/`
- **User Need**: Ability to resume/continue sessions regardless of execution mode

## Solution Approaches

### 1. Leverage Claude's Native Logs

**Concept**: Use Claude's own JSONL conversation logs as the source of truth

**Ideas**:
- Store conversation start timestamp in our session
- Scan `~/.claude/logs/conversations/` directory for matching timestamp
- Parse JSONL to extract session IDs when needed
- Add `claudeConversationPath` reference to our session storage

**Pros**: 
- No duplication of data
- Works even if our process crashes
- Can recover "lost" sessions

**Cons**: 
- Depends on Claude's log structure
- Need filesystem access to `~/.claude`
- Log scanning might be slow with many conversations

### 2. ChannelCoder Session ID Abstraction

**Concept**: Use our own stable session IDs that map to Claude's session chains

**Ideas**:
- Generate `cc-session-{uuid}` for each session
- Maintain a mapping file: `~/.channelcoder/session-map.json`
- Update mapping asynchronously as Claude IDs are discovered
- User always uses our IDs, never Claude's directly

**Pros**: 
- Clean abstraction layer
- Session IDs stable across executions
- Can add additional metadata

**Cons**: 
- Another layer of indirection
- Need to maintain mapping integrity
- Still need to discover Claude IDs somehow

### 3. Enhanced Log File Format

**Concept**: Write both user log and session metadata simultaneously

**Ideas**:
- Alongside `output.log`, create `output.session.json`
- Stream parser writes session updates to metadata file
- Include session IDs, timestamps, message counts
- Session object monitors metadata file in detached mode

**Pros**: 
- Dedicated session tracking
- Easy to monitor and parse
- Works with existing stream parser

**Cons**: 
- More files to manage
- Need to ensure atomic updates
- Cleanup complexity

### 4. Post-Execution Session Recovery

**Concept**: Lazy session ID resolution when actually needed

**Ideas**:
- Don't capture session ID immediately
- When resume requested, implement discovery:
  - Check our session storage first
  - Parse log file if needed
  - Scan Claude's JSONL as fallback
- Cache discovered IDs for performance

**Pros**: 
- No real-time requirements
- Multiple fallback options
- Works with truly detached processes

**Cons**: 
- First resume might be slow
- Discovery logic complexity
- Need good error handling

### 5. IPC-Based Session Communication

**Concept**: Use inter-process communication for session updates

**Ideas**:
- Create named pipe or Unix socket
- Detached process sends session updates via IPC
- Parent or monitor service receives updates
- Updates written to session storage

**Pros**: 
- Real-time updates
- No file watching needed
- Clean separation of concerns

**Cons**: 
- Platform complexity (Windows vs Unix)
- Need monitoring service
- IPC failure handling

### 6. Session Continuation Tokens

**Concept**: Generate continuation tokens that encode enough context

**Ideas**:
- Token contains: timestamp, first message hash, working directory
- Use token to find matching conversation in any log source
- Similar to how OAuth refresh tokens work
- Token can be used even without our session storage

**Pros**: 
- Portable session references
- Resilient to storage failures
- Can share sessions via tokens

**Cons**: 
- Token generation complexity
- Need robust matching algorithm
- Privacy considerations

### 7. Hybrid Approach

**Concept**: Combine multiple strategies for robustness

**Ideas**:
- Primary: ChannelCoder session ID + metadata file
- Secondary: Parse detached process log file
- Fallback: Scan Claude's native JSONL logs
- Cache: Store discovered mappings for performance

**Implementation Layers**:
1. Quick check: Our session storage
2. Log parse: Check detached log file for session IDs
3. JSONL scan: Search Claude's logs by timestamp/content
4. Cache results: Update session mappings

## Recommended Path Forward

1. **Short Term**: Implement post-execution log parsing
   - Add session ID extraction to stream parser
   - Update session after detached execution completes
   - Minimal changes to existing architecture

2. **Medium Term**: Add ChannelCoder session abstraction
   - Stable IDs for users
   - Mapping to Claude's session chains
   - Better session portability

3. **Long Term**: Leverage Claude's native logs
   - Build robust JSONL discovery
   - Remove duplication of conversation data
   - Support session recovery from any state

## Key Questions

1. Should we require session objects for detached mode?
2. How important is immediate session ID availability vs lazy resolution?
3. Should we build dependency on Claude's log structure?
4. What's the performance impact of log scanning?
5. How do we handle Docker/worktree session isolation?

## Next Steps

- [ ] Prototype JSONL discovery mechanism
- [ ] Test performance of log scanning with many conversations
- [ ] Design session mapping schema
- [ ] Evaluate IPC options for real-time updates
- [ ] Create session recovery test suite