# SDK Integration Plan for ChannelCoder

## Goal
Replace process spawning with official Claude Code SDK while maintaining 100% backward compatibility.

## Integration Strategy

### 1. Environment-based SDK Usage

In `process.ts`, add SDK detection:

```typescript
// At the top of CCProcess class
private useSDK: boolean = process.env.CC_USE_SDK === 'true' || false;

// In execute() method
async execute(prompt: string, options: CCOptions & PromptConfig): Promise<CCResult> {
  // Existing worktree/docker checks...
  
  if (this.useSDK) {
    return executeWithSDK(prompt, options);
  }
  
  // Existing CLI spawning code...
}

// In stream() method
async *stream(prompt: string, options: CCOptions & PromptConfig): AsyncIterable<StreamChunk> {
  // Existing worktree/docker checks...
  
  if (this.useSDK) {
    yield* streamWithSDK(prompt, options);
    return;
  }
  
  // Existing CLI spawning code...
}
```

### 2. Feature Flags for Gradual Rollout

```typescript
// Configuration options
interface SDKConfig {
  enabled: boolean;
  fallbackToCLI: boolean;  // If SDK fails, try CLI
  modes: {
    run: boolean;        // Use SDK for run mode
    stream: boolean;     // Use SDK for stream mode
    interactive: boolean; // Use SDK for interactive (probably false)
  };
}

// Usage
const sdkConfig: SDKConfig = {
  enabled: process.env.CC_USE_SDK === 'true',
  fallbackToCLI: true,
  modes: {
    run: true,
    stream: true,
    interactive: false, // Keep using CLI for interactive
  }
};
```

### 3. Adapter Pattern Implementation

The SDK adapter functions handle the mapping between:
- ChannelCoder options → SDK options
- SDK responses → CCResult format
- SDK events → StreamChunk format

### 4. Session ID Extraction

The SDK likely provides session IDs differently than parsing CLI output:

```typescript
// Current: Parse from stderr/stdout
const sessionMatch = stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);

// With SDK: Direct access
const sessionId = sdkResult.sessionId || sdkResult.session?.id;
```

### 5. Testing Strategy

1. **Unit Tests**: Mock both CLI and SDK responses
2. **Integration Tests**: Test with CC_USE_SDK=true and false
3. **Compatibility Tests**: Ensure identical behavior between implementations

### 6. Migration Path

1. **Phase 1**: Add SDK adapter, disabled by default
2. **Phase 2**: Enable for specific users via environment variable
3. **Phase 3**: Gradual rollout with fallback
4. **Phase 4**: Make SDK default, CLI as fallback
5. **Phase 5**: Remove CLI spawning code

## Benefits

1. **Less Brittle**: No more parsing CLI output
2. **Better Performance**: Direct API calls vs process spawning
3. **Enhanced Features**: Access to SDK-only capabilities
4. **Type Safety**: Full TypeScript support from SDK
5. **Better Error Handling**: Structured errors vs text parsing

## Challenges

1. **Interactive Mode**: SDK may not support process replacement
2. **Docker/Worktree**: May need special handling with SDK
3. **Output Format Parity**: Ensure SDK responses match CLI format
4. **Feature Gaps**: Some CLI features might not be in SDK yet

## Example Usage (No API Changes!)

```typescript
// Users don't need to change anything!
import { claude, stream } from 'channelcoder';

// Works the same whether using CLI or SDK internally
const result = await claude('Analyze this code', {
  tools: ['Read', 'Write'],
  resume: sessionId
});

// Streaming works the same
for await (const chunk of stream('Generate docs', options)) {
  console.log(chunk.content);
}
```

## Implementation Checklist

- [ ] Install official Claude Code SDK
- [ ] Create sdk-adapter.ts with conversion functions
- [ ] Add SDK detection to CCProcess
- [ ] Update execute() to use SDK when enabled
- [ ] Update stream() to use SDK when enabled
- [ ] Handle interactive mode (keep CLI for now)
- [ ] Add comprehensive tests
- [ ] Document environment variables
- [ ] Create migration guide for deployment