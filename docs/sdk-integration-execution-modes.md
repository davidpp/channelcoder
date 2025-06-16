# SDK Integration: Execution Mode Analysis

## Overview
This document specifically addresses how SDK integration affects Docker, Worktree, Detached, and Interactive execution modes.

## Key Finding: Process Spawning Still Required

### 1. Docker Mode 🐳
**Must Keep Process Spawning**

Current implementation spawns:
```bash
docker run [options] claude-code-image claude --print [args]
```

#### Why Process Spawning is Required:
- Docker CLI is the only way to run containers
- No Docker SDK that replaces `docker run`
- Volume mounts, environment variables need Docker CLI

#### SDK Integration Options:

**Option A: SDK Inside Container (Recommended)**
```dockerfile
# Create new Docker image with SDK
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install @anthropic-ai/claude-code-sdk
COPY sdk-runner.js .
ENTRYPOINT ["node", "sdk-runner.js"]
```

Then spawn:
```bash
docker run [options] channelcoder-sdk:latest
```

**Option B: Keep Current Approach**
- Continue using Claude CLI in container
- Lose SDK benefits for Docker mode

### 2. Worktree Mode 🌳
**Hybrid Approach: Git Commands + SDK**

Current implementation:
1. Uses `simple-git` to create/manage worktrees
2. Changes directory to worktree
3. Spawns Claude process in that directory

#### SDK Integration:
```typescript
// Step 1: Still need git commands (process spawning)
await git.worktree.add(worktreePath, branch);

// Step 2: Can use SDK with working directory option
const result = await sdk.query(prompt, {
  ...options,
  workingDirectory: worktreePath
});

// Alternative: Keep process.chdir() approach
const originalCwd = process.cwd();
process.chdir(worktreePath);
const result = await sdk.query(prompt, options);
process.chdir(originalCwd);
```

### 3. Detached Mode 🚀
**Must Keep Process Spawning**

Current implementation:
```typescript
const child = spawn('claude', args, {
  detached: true,
  stdio: ['pipe', logFd, logFd]
});
child.unref(); // Allow parent to exit
```

#### Why Process Spawning is Required:
- SDK runs in current process
- True background execution needs OS-level process detachment
- `child.unref()` allows parent Node.js to exit

#### SDK Integration Approach:
Create a thin wrapper script:
```javascript
// sdk-detached-runner.js
#!/usr/bin/env node
const sdk = require('@anthropic-ai/claude-code-sdk');
const fs = require('fs');

async function main() {
  const options = JSON.parse(process.env.CC_OPTIONS);
  const prompt = fs.readFileSync(0, 'utf-8'); // Read from stdin
  
  const result = await sdk.query(prompt, options);
  console.log(JSON.stringify(result));
}

main().catch(console.error);
```

Then spawn this wrapper:
```typescript
const child = spawn('node', ['sdk-detached-runner.js'], {
  detached: true,
  stdio: ['pipe', logFd, logFd],
  env: { ...process.env, CC_OPTIONS: JSON.stringify(options) }
});
```

### 4. Interactive Mode 💬
**Cannot Use SDK - Must Keep Process Spawning**

Current implementation:
```bash
exec echo "${prompt}" | exec claude [args]
```

#### Why SDK Cannot Work:
- Interactive mode **replaces** the Node.js process with Claude CLI
- Users expect direct Claude CLI interaction
- No Node.js runtime remains after `exec`
- SDK requires Node.js runtime to function

This is a fundamental limitation - interactive mode is about giving users direct CLI access.

## Summary Table

| Mode | Can Use SDK? | Process Spawning Required | Approach |
|------|--------------|--------------------------|----------|
| Run | ✅ Yes | No | Direct SDK calls |
| Stream | ✅ Yes | No | SDK streaming API |
| Interactive | ❌ No | Yes - Always | Keep current `exec` approach |
| Detached | 🟡 Partial | Yes - Always | Spawn wrapper script with SDK |
| Docker | 🟡 Partial | Yes - Always | SDK in container or keep CLI |
| Worktree | 🟡 Partial | Yes - Git only | Git setup + SDK execution |

## Architecture Decision

### Two-Layer Approach

1. **Execution Layer** (Choose based on mode):
   - SDK Execution (for compatible modes)
   - Process Execution (for special modes)

2. **Context Layer** (Always required for special contexts):
   - Docker Context (docker run)
   - Worktree Context (git commands)
   - Detached Context (spawn with detached: true)

### Implementation Strategy

```typescript
class CCProcess {
  async execute(prompt: string, options: CCOptions): Promise<CCResult> {
    // Layer 1: Context Setup (if needed)
    if (options.docker) {
      return this.executeInDocker(prompt, options); // Must spawn docker
    }
    
    if (options.worktree) {
      await this.setupWorktree(options); // Git commands
      // Then can use SDK or CLI
    }
    
    if (options.detached) {
      return this.executeDetached(prompt, options); // Must spawn process
    }
    
    // Layer 2: Execution Method
    if (options.mode === 'interactive') {
      return this.launchInteractive(prompt, options); // Must use exec
    }
    
    // Can use SDK for regular run/stream
    if (this.sdkAvailable && !options.forceCliMode) {
      return this.executeWithSDK(prompt, options);
    }
    
    // Fallback to CLI
    return this.executeWithCLI(prompt, options);
  }
}
```

## Conclusion

SDK integration will improve core functionality (run/stream modes) but cannot replace process spawning for:
- **Docker**: Requires `docker` CLI
- **Interactive**: Requires process replacement
- **Detached**: Requires OS-level process management
- **Worktree**: Requires `git` commands

The hybrid architecture maintains all current capabilities while leveraging SDK benefits where possible.