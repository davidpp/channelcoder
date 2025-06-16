# Comprehensive SDK Integration Analysis for ChannelCoder

## Executive Summary

This document analyzes the feasibility of replacing process spawning with the official Claude Code SDK across all ChannelCoder features. The analysis reveals that while core functionality can use the SDK, several features inherently require process spawning.

## Feature Compatibility Matrix

| Feature | Current Implementation | SDK Compatible | Notes |
|---------|----------------------|----------------|-------|
| Run Mode | `spawn` process | ✅ Yes | Direct SDK replacement |
| Stream Mode | `spawn` with streaming | ✅ Yes | SDK streaming API |
| Interactive Mode | `execSync` with shell | ❌ No | Process replacement required |
| Detached Mode | `spawn` with `detached: true` | 🟡 Partial | Hybrid approach needed |
| Docker Execution | `docker run` | ❌ No | Docker CLI required |
| Worktree Execution | `git` commands | 🟡 Partial | Git setup + SDK execution |
| Session Management | CLI flags | ✅ Yes | SDK native support |
| Tool Configuration | CLI flags | ✅ Yes | SDK configuration |
| MCP Support | CLI flags | ❓ Unknown | Depends on SDK support |

## Detailed Analysis by Feature

### 1. Standard Execution Modes

#### Run Mode (Default)
```typescript
// Current: Process spawning
const proc = spawn('claude', ['--print', ...args]);

// With SDK: Direct API call
const result = await sdk.query(prompt, options);
```
**Migration**: Straightforward replacement

#### Stream Mode
```typescript
// Current: Parse streaming output
proc.stdout.on('data', chunk => parseStreamEvent(chunk));

// With SDK: Native streaming
for await (const event of sdk.stream(prompt, options)) {
  yield convertEvent(event);
}
```
**Migration**: Map SDK events to ChannelCoder chunks

### 2. Complex Execution Contexts

#### Interactive Mode
**Current Implementation**:
```typescript
// Process replacement using shell exec
execSync(`exec echo '${prompt}' | exec claude ${args}`, {
  stdio: 'inherit',
  shell: true
});
```

**SDK Limitation**: The SDK cannot replace the Node.js process with Claude CLI. This is a fundamental OS-level operation that requires process spawning.

**Recommendation**: Keep current implementation for interactive mode.

#### Detached Mode
**Current Implementation**:
```typescript
const proc = spawn('claude', args, {
  detached: true,
  stdio: ['pipe', logFd, logFd]
});
proc.unref(); // Allow parent to exit
```

**Hybrid Approach**:
```typescript
// Option 1: Node.js worker thread with SDK
const worker = new Worker('./sdk-worker.js');
worker.postMessage({ prompt, options });

// Option 2: Child process running SDK code
const child = fork('./sdk-runner.js', [], {
  detached: true,
  stdio: 'ignore'
});
```

**Recommendation**: Create a lightweight Node.js script that uses the SDK, spawn that as a detached process.

### 3. Container and Environment Execution

#### Docker Execution
**Current Flow**:
1. Build/pull Docker image
2. Run container with Claude CLI
3. Mount volumes and pass environment

**SDK Integration Options**:

**Option 1: SDK in Container (Recommended)**
```dockerfile
# Dockerfile.sdk
FROM node:20-slim
RUN npm install @anthropic-ai/claude-code-sdk channelcoder
COPY sdk-runner.js /app/
ENTRYPOINT ["node", "/app/sdk-runner.js"]
```

**Option 2: Keep CLI in Container**
- Continue using current approach
- SDK benefits lost for Docker mode

**Option 3: Remote SDK Execution**
- SDK runs on host, communicates with container
- Complex networking and security considerations

#### Worktree Execution
**Current Flow**:
1. Create/checkout git worktree
2. Change directory to worktree
3. Execute Claude in that context

**SDK Integration**:
```typescript
// Setup worktree (still needs git)
await git.worktree.add(path, branch);

// Execute with SDK in worktree context
process.chdir(worktreePath);
const result = await sdk.query(prompt, {
  ...options,
  workingDirectory: worktreePath
});
```

**Recommendation**: Keep git operations, use SDK for execution within worktree.

### 4. Implementation Strategy

#### Phase 1: Core SDK Integration
```typescript
// Add SDK adapter
export const sdkAdapter = {
  available: false,
  
  async init() {
    try {
      // Initialize SDK
      this.sdk = await createSDK();
      this.available = true;
    } catch {
      this.available = false;
    }
  },
  
  async execute(prompt: string, options: CCOptions): Promise<CCResult> {
    if (!this.available) throw new Error('SDK not available');
    return convertFromSDK(await this.sdk.query(prompt, convertToSDK(options)));
  }
};
```

#### Phase 2: Feature-Specific Strategies
```typescript
// Execution strategy selector
function getExecutionStrategy(options: CCOptions): ExecutionStrategy {
  // Interactive always uses CLI
  if (options.mode === 'interactive') {
    return new CLIStrategy();
  }
  
  // Docker requires special handling
  if (options.docker) {
    return new DockerStrategy(sdkAdapter.available);
  }
  
  // Detached mode hybrid
  if (options.detached) {
    return new DetachedStrategy(sdkAdapter.available);
  }
  
  // Default to SDK if available
  return sdkAdapter.available ? new SDKStrategy() : new CLIStrategy();
}
```

### 5. Migration Challenges

#### Session ID Extraction
**Current**: Parse from CLI output
```typescript
// From stderr
const match = stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);

// From stream events
const sessionId = extractSessionId(parseStreamEvent(line));
```

**SDK**: Direct access
```typescript
const result = await sdk.query(prompt, options);
const sessionId = result.session.id;
```

#### Tool Configuration
**Current**: CLI flags
```bash
claude --tools Read Write "Bash(git:*)" --disallowed-tools Execute
```

**SDK**: Configuration object
```typescript
sdk.configure({
  tools: {
    allowed: ['Read', 'Write', { name: 'Bash', restrictions: 'git:*' }],
    disallowed: ['Execute']
  }
});
```

### 6. Docker-Specific Considerations

For Docker mode, we have several options:

#### Option 1: Minimal SDK Runner (Recommended)
Create a minimal Node.js application that uses the SDK:

```javascript
// sdk-runner.js
const { createSDK } = require('@anthropic-ai/claude-code-sdk');

async function main() {
  const sdk = await createSDK();
  const options = JSON.parse(process.env.CC_OPTIONS);
  const prompt = await readStdin();
  
  const result = await sdk.query(prompt, options);
  console.log(JSON.stringify(result));
}

main().catch(console.error);
```

#### Option 2: ChannelCoder Server Mode
Create a server mode for ChannelCoder that can run in Docker:

```typescript
// server.ts
import express from 'express';
import { executeWithSDK } from './sdk-adapter';

const app = express();
app.post('/execute', async (req, res) => {
  const result = await executeWithSDK(req.body.prompt, req.body.options);
  res.json(result);
});
```

### 7. Feature Retention Strategy

#### Features to Keep with CLI:
1. **Interactive Mode** - Core UX feature
2. **Shell Integration** - Some users depend on shell features
3. **Emergency Fallback** - When SDK is unavailable

#### Features to Migrate:
1. **Run/Stream Modes** - Primary SDK targets
2. **Session Management** - Better with SDK
3. **Tool Configuration** - Cleaner with SDK

#### Hybrid Features:
1. **Detached Mode** - SDK wrapped in subprocess
2. **Docker Mode** - SDK in container
3. **Worktree Mode** - Git setup + SDK execution

## Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│                  ChannelCoder API                    │
│          (No changes - backward compatible)          │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────┐
│              Execution Strategy Layer                │
├─────────────────────────────────────────────────────┤
│  - Selects appropriate strategy based on options    │
│  - Handles fallback logic                           │
│  - Manages feature detection                        │
└─────────────┬───────────────┬───────────────────────┘
              │               │
┌─────────────┴────┐    ┌─────┴────────────────────┐
│   SDK Strategy   │    │    Process Strategy       │
├──────────────────┤    ├───────────────────────────┤
│ - Direct SDK     │    │ - CLI spawning            │
│ - Run mode       │    │ - Interactive mode        │
│ - Stream mode    │    │ - Docker execution        │
│ - Sessions       │    │ - Complex shell features  │
└──────────────────┘    └───────────────────────────┘
              │               │
              └───────┬───────┘
                      │
         ┌────────────┴────────────┐
         │    Hybrid Strategies    │
         ├─────────────────────────┤
         │ - Detached + SDK        │
         │ - Worktree + SDK        │
         │ - Docker + SDK runner   │
         └─────────────────────────┘
```

## Implementation Timeline

### Week 1-2: SDK Adapter Development
- Create sdk-adapter module
- Implement option conversion
- Add response mapping

### Week 3-4: Core Integration
- Modify CCProcess for SDK support
- Add feature detection
- Implement fallback logic

### Week 5-6: Hybrid Strategies
- Detached mode with SDK
- Docker SDK runner
- Worktree integration

### Week 7-8: Testing & Documentation
- Comprehensive test suite
- Migration documentation
- Performance benchmarking

## Conclusion

The SDK integration is feasible for core functionality but requires a hybrid approach for advanced features. The proposed architecture maintains backward compatibility while leveraging SDK benefits where possible. Process spawning remains necessary for interactive mode, Docker integration, and true background execution.