# Session SDK Architecture

## Overview

This document defines the session management architecture for ChannelCoder. The design focuses on essential session features while maintaining ChannelCoder's philosophy of simplicity, functional design, and CLI-mirroring behavior.

## Core Philosophy

1. **Minimal by Default**: Basic usage remains unchanged
2. **Progressive Enhancement**: Add session features only when needed
3. **Functional Pattern**: No mandatory OOP, sessions through functions
4. **CLI-First**: Mirror Claude CLI's session behavior
5. **Template Compatible**: Works seamlessly with existing template system

## Essential Session Features (v1)

### 1. Basic Session Management
- Create and maintain conversation context
- Automatic session ID chaining (Claude CLI behavior)
- Simple API through `session()` function

### 2. Session Persistence
- Save/load sessions to continue later
- File-based storage by default
- Automatic session discovery

### 3. Integration
- Works with all existing features (templates, validation, tools)
- Session data available in templates
- Maintains stateless option for simple use

## API Design

### Basic Usage

```typescript
import { claude, session } from 'channelcoder';

// Traditional stateless (unchanged)
await claude('What is TypeScript?');

// Session-aware usage
const s = session();
await s.claude('What is TypeScript?');
await s.claude('Show me an example');  // Automatically continues
```

### Core Session API

```typescript
interface Session {
  // Wrapped functions with session context
  claude: typeof claude;
  stream: typeof stream;
  interactive: typeof interactive;
  run: typeof run;
  
  // Essential session methods
  id(): string;              // Get current session ID
  messages(): Message[];     // Get conversation history
  save(name?: string): Promise<string>;  // Save session
  clear(): void;            // Clear session
}

// Session factory function
function session(options?: SessionOptions): Session;

// Load existing session
session.load(nameOrPath: string): Promise<Session>;

// List saved sessions
session.list(): Promise<SessionInfo[]>;
```

## Implementation Architecture

### Session State

```typescript
interface SessionState {
  // Claude CLI session chain
  sessionChain: string[];         // All session IDs in order
  currentSessionId?: string;      // Latest session ID
  
  // Conversation history
  messages: Message[];
  
  // Metadata
  metadata: {
    name?: string;
    created: Date;
    lastActive: Date;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
}
```

### Session Chain Management

Claude CLI returns a new session ID with each response. The session manager must track this chain:

```typescript
class SessionManager {
  private state: SessionState = {
    sessionChain: [],
    messages: []
  };
  
  async executeWithSession(
    fn: Function,
    prompt: string,
    options?: ClaudeOptions
  ): Promise<CCResult<any>> {
    // Use latest session ID from chain
    const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];
    
    const result = await fn(prompt, {
      ...options,
      resume: resumeId || options?.resume
    });
    
    // Track new session ID
    if (result.success && result.sessionId) {
      this.state.sessionChain.push(result.sessionId);
      this.state.currentSessionId = result.sessionId;
      
      // Track messages
      this.addMessage('user', prompt);
      this.addMessage('assistant', result.data);
    }
    
    return result;
  }
}
```

### Storage Layer

Simple file-based storage for v1:

```typescript
class FileSessionStorage {
  private basePath = '.channelcoder/sessions';
  
  async save(state: SessionState, name?: string): Promise<string> {
    const filename = name || `session-${Date.now()}.json`;
    const filepath = path.join(this.basePath, filename);
    
    await ensureDir(this.basePath);
    await writeFile(filepath, JSON.stringify(state, null, 2));
    
    return filepath;
  }
  
  async load(nameOrPath: string): Promise<SessionState> {
    // Handle both names and full paths
    const filepath = nameOrPath.includes('/') 
      ? nameOrPath 
      : path.join(this.basePath, nameOrPath);
      
    const data = await readFile(filepath, 'utf-8');
    return JSON.parse(data);
  }
  
  async list(): Promise<SessionInfo[]> {
    const files = await glob(`${this.basePath}/*.json`);
    return Promise.all(files.map(f => this.getInfo(f)));
  }
}
```

## Integration with Existing Features

### Template Integration

Session data available in templates:

```typescript
// In templates
const s = session();
await s.claude`Current session: ${s.id()}`;
await s.claude`Messages so far: ${s.messages().length}`;

// In file-based prompts
await s.claude('prompts/continue-analysis.md', {
  data: {
    previousMessages: s.messages().slice(-3)
  }
});
```

### Frontmatter Support

```yaml
---
# prompts/debug-session.md
session:
  required: true  # This prompt requires a session
  
systemPrompt: "You are debugging based on our conversation"
---

Continue debugging the issue we discussed.

Context from last message: {session.lastMessage}
```

### CLI Integration

```bash
# Start a new session
channelcoder prompts/start.md --session

# Continue a session by name
channelcoder prompts/continue.md --session my-debug-session

# List sessions
channelcoder --list-sessions

# Load specific session
channelcoder --load-session .channelcoder/sessions/feature-x.json
```

## Implementation Phases

### Phase 1: Core Session Management (MVP)
- [x] Basic session tracking
- [x] Automatic session ID chaining
- [x] Message history
- [x] Session wrapper functions

### Phase 2: Persistence
- [ ] File-based storage
- [ ] Save/load functionality
- [ ] Session listing
- [ ] CLI integration

### Phase 3: Enhanced Features
- [ ] Session templates in frontmatter
- [ ] Session metadata and tags
- [ ] Search within sessions
- [ ] Session export formats

### Future Considerations (Not in v1)
- Fork/branch sessions
- Checkpoints and rollback
- Team sharing
- Alternative storage backends
- Session analytics

## Example Implementations

### Basic Debugging Session

```typescript
import { session } from 'channelcoder';

// Start debugging session
const debug = session();

// First interaction
await debug.claude('I have a null pointer error in auth.js');

// Continue with context
await debug.claude('Show me line 45');

// Save for later
await debug.save('auth-debug');

// Later, continue where left off
const debug2 = await session.load('auth-debug');
await debug2.claude('Did you find the issue?');
```

### Long-Running Feature Development

```typescript
// Day 1: Planning
const feature = session();
await feature.claude('prompts/plan-oauth.md', {
  data: { providers: ['google', 'github'] }
});
await feature.save('oauth-implementation');

// Day 2: Continue implementation
const feature = await session.load('oauth-implementation');
await feature.claude('Implement the Google provider first');

// Check progress
console.log(`Session: ${feature.id()}`);
console.log(`Messages: ${feature.messages().length}`);
```

## Key Differences from claude-code-js

1. **Simplicity First**: No forking, branching, or complex state management in v1
2. **Functional API**: `session()` returns enhanced functions, not a class
3. **File-centric**: Leverages ChannelCoder's file-based approach
4. **Template Integration**: Session data works with template system
5. **CLI Parity**: Can be used from both SDK and CLI

## Technical Decisions

### Why Functions over Classes
- Maintains ChannelCoder's functional philosophy
- Simpler mental model
- Natural progression from stateless to stateful

### Why File Storage Default
- Visible and shareable
- No hidden state
- Easy debugging
- Natural for CLI usage

### Why Session Chains
- Required by Claude CLI behavior
- Ensures proper conversation continuation
- Transparent session evolution

## Migration Guide

### From Stateless to Sessions

```typescript
// Before (stateless)
const result1 = await claude('Hello');
const sessionId = result1.sessionId;
const result2 = await claude('Continue', { resume: sessionId });

// After (with sessions)
const s = session();
await s.claude('Hello');
await s.claude('Continue');  // Automatic
```

### From Manual to Managed

```typescript
// Before (manual tracking)
let sessionId;
const messages = [];

const r1 = await claude('Start');
sessionId = r1.sessionId;
messages.push({ role: 'user', content: 'Start' });
messages.push({ role: 'assistant', content: r1.data });

// After (managed)
const s = session();
await s.claude('Start');
console.log(s.messages());  // Automatic tracking
```

## Conclusion

This session architecture provides essential conversation management while maintaining ChannelCoder's core philosophy. It's simple by default, powerful when needed, and integrates seamlessly with existing features. Advanced features like forking and checkpoints are intentionally deferred to keep the initial implementation focused and maintainable.