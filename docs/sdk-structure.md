# ChannelCoder SDK Structure

## Overview

The ChannelCoder SDK provides a simple, function-based API that mirrors the Claude CLI's mental model while enabling powerful programmatic use cases.

## Core Design Principles

1. **CLI Parity**: The SDK mirrors Claude CLI patterns for familiarity
2. **Function-First**: No classes needed - just imported functions
3. **Options-Based**: Configuration through options objects, enabling easy wrapper functions
4. **Progressive Disclosure**: Simple use cases are simple, complex ones are possible

## Primary API

### Main Function: `claude()`

```typescript
import { claude } from 'channelcoder';

// File-based prompt (detected by .md extension)
const result = await claude('prompts/analyze.md', {
  data: { taskId: 'FEAT-123' },
  tools: ['Read', 'Write'],
  system: 'Be concise'
});

// Inline string prompt (no .md extension)
const result = await claude('Analyze task ${taskId}', {
  data: { taskId: 'FEAT-123' }
});

// Template literal support
const result = await claude`Analyze task ${taskId}`;
```

### Execution Modes

Different execution modes are available as separate functions or via options:

```typescript
import { claude, interactive, stream, run } from 'channelcoder';

// As separate functions
await interactive('prompts/analyze.md', { data });
await stream('prompts/analyze.md', { data });
await run('prompts/analyze.md', { data });

// Or via options
await claude('prompts/analyze.md', { 
  data,
  mode: 'interactive' // 'run' | 'stream' | 'interactive'
});
```

#### Mode Behavior

Each mode generates different Claude CLI commands:

1. **`run` mode (default)**: Non-interactive execution with `--print` flag
   - Executes autonomously and returns the complete result
   - Command: `echo "prompt" | claude --print [options]`
   - Returns: `CCResult` with parsed response

2. **`stream` mode**: Non-interactive streaming with `--print` and `--output-format stream-json`
   - Yields real-time chunks as Claude processes
   - Command: `echo "prompt" | claude --print --output-format stream-json [options]`
   - Returns: AsyncIterable of `StreamChunk`

3. **`interactive` mode**: Launches Claude interactively WITHOUT `--print`
   - Replaces the current process using shell `exec`
   - Command: `exec echo "prompt" | exec claude [options]`
   - Never returns - process is replaced

4. **`detached` mode**: Background execution with optional streaming
   - Runs Claude in detached background process
   - Command: `claude --print [options] &` (with stdio redirection)
   - Returns: `CCResult` with process metadata (PID, logFile, etc.)
   - With `stream: true`: Uses `--output-format stream-json` for real-time log updates

#### Resume/Continue Behavior

All modes support session continuation:

```typescript
// Run mode with resume
await run('Continue analysis', { resume: sessionId });
// Command: claude --print --resume SESSION_ID

// Stream mode with continue
await stream('Continue', { continue: true });
// Command: claude --print --output-format stream-json --continue

// Interactive mode with resume (no prompt needed)
await interactive('', { resume: sessionId });
// Command: exec claude --resume SESSION_ID
```

Note: When resuming/continuing, no prompt is piped to stdin.

## Options Object

The options object maps closely to Claude CLI flags:

```typescript
interface ClaudeOptions {
  // Data & Prompts
  data?: Record<string, any>;        // Variable interpolation
  system?: string;                   // System prompt (inline or .md file)
  appendSystem?: string;             // Append to system prompt
  
  // Tools
  tools?: string[];                  // Allowed tools (maps to --tools)
  disallowedTools?: string[];        // Disallowed tools
  mcpConfig?: string;                // MCP server config file
  permissionTool?: string;           // MCP permission tool
  
  // Session Management
  resume?: string;                   // Resume session by ID
  continue?: boolean;                // Continue most recent session
  
  // Execution Control
  maxTurns?: number;                 // Limit agentic turns
  mode?: 'run' | 'stream' | 'interactive';  // Execution mode
  includeEvents?: boolean;           // Include event tracking
  
  // Other
  verbose?: boolean;                 // Verbose output
  outputFormat?: 'json' | 'text';    // Output format
}
```

## Return Types

### Standard Result

```typescript
interface CCResult<T = any> {
  // Core fields
  success: boolean;
  data?: T;           // Parsed response data
  error?: string;     // Error message if failed
  
  // Raw output
  stdout?: string;    // Raw stdout for debugging
  stderr?: string;    // Raw stderr
  warnings?: string[];
  
  // Metadata (when available)
  metadata?: {
    sessionId: string;      // Session ID for continuation
    cost: number;           // Cost in USD for this turn
    totalCost: number;      // Cumulative cost
    turns: number;          // Number of conversation turns
    duration: number;       // Total duration in ms
    apiDuration: number;    // API call duration in ms
    isMaxTurns: boolean;    // Hit turn limit
  };
  
  // Events (when includeEvents: true)
  events?: Array<
    | { type: 'content'; text: string; timestamp: number }
    | { type: 'tool_use'; tool: string; input: any; timestamp: number }
    | { type: 'tool_result'; tool: string; output: any; timestamp: number }
  >;
}
```

### Streaming

```typescript
// Stream mode yields chunks
for await (const chunk of stream('prompt', options)) {
  console.log(chunk.content);
}

interface StreamChunk {
  type: 'content' | 'tool_use' | 'tool_result' | 'error';
  content: string;
  tool?: string;
  timestamp: number;
}
```

### Interactive Launch

```typescript
// Interactive mode replaces the current process
await interactive('prompt', options);
// This line is never reached - process is replaced

interface LaunchResult {
  error?: string;      // Launch error if any (only returned on failure)
  exitCode?: number;   // Exit code (only for compatibility, rarely used)
}
```

**Important**: Interactive mode uses shell `exec` to replace the Node.js process with Claude. This means:
- No Node.js parent process remains in memory
- Direct signal handling by Claude
- Exit codes go directly to the shell
- Code after `interactive()` is never executed

## File Detection

The SDK automatically detects whether the first argument is a file or prompt:

- **File**: Ends with `.md` or contains path separators (`/`, `\`)
- **Prompt**: Everything else is treated as an inline prompt

```typescript
// These are detected as files
await claude('prompts/analyze.md', options);
await claude('./analyze.md', options);
await claude('some/path/to/prompt.md', options);

// These are inline prompts
await claude('Analyze this', options);
await claude('What is 2+2?', options);
```

## Variable Interpolation

### In Prompt Files

```markdown
---
tools: [Read, Write]
---

Analyze task {taskId} with context: {context || 'No context provided'}

{#if includeDetails}
Include implementation details
{#endif}
```

### In Inline Prompts

```typescript
// Using data option
await claude('Analyze {taskId}', {
  data: { taskId: 'FEAT-123' }
});

// Using template literals
const taskId = 'FEAT-123';
await claude`Analyze ${taskId}`;
```

## Common Patterns

### Creating Wrapper Functions

```typescript
// Domain-specific wrapper
async function analyzeTask(taskId: string, options = {}) {
  return claude('prompts/analyze-task.md', {
    data: { taskId },
    tools: ['Read', 'Grep'],
    ...options  // Allow overrides
  });
}

// Usage
await analyzeTask('FEAT-123');
await analyzeTask('FEAT-123', { verbose: true });
```

### Session Management

```typescript
// Simple session continuation
const first = await claude('Start analysis', options);
const second = await claude('Continue', {
  resume: first.metadata?.sessionId
});

// Stateful wrapper
class ClaudeSession {
  private sessionId?: string;
  
  async send(prompt: string, options = {}) {
    const result = await claude(prompt, {
      resume: this.sessionId,
      ...options
    });
    
    this.sessionId = result.metadata?.sessionId;
    return result;
  }
}
```

### Error Handling

```typescript
const result = await claude('prompts/analyze.md', options);

if (!result.success) {
  console.error('Error:', result.error);
  
  // Check specific error types
  if (result.metadata?.isMaxTurns) {
    console.log('Hit max turns limit');
  }
  
  // Raw stderr available for debugging
  if (result.stderr) {
    console.error('Stderr:', result.stderr);
  }
}
```

### Cost Tracking

```typescript
let totalSpent = 0;

async function trackCosts(prompt: string, options = {}) {
  const result = await claude(prompt, options);
  
  if (result.metadata?.cost) {
    totalSpent += result.metadata.cost;
    console.log(`Turn cost: $${result.metadata.cost}`);
    console.log(`Total spent: $${totalSpent}`);
  }
  
  return result;
}
```

## Tool Patterns

The SDK passes tool specifications directly to Claude:

```typescript
// Simple tool list
await claude('prompt', {
  tools: ['Read', 'Write', 'Bash']
});

// Tool restrictions (Claude CLI syntax)
await claude('prompt', {
  tools: ['Bash(git:*)', 'Read(**/*.ts)']
});

// Disallow specific tools
await claude('prompt', {
  tools: ['Read', 'Write'],
  disallowedTools: ['Bash']
});
```

## Migration from Class-Based API

For users migrating from the previous class-based API:

```typescript
// Old way
const result = await cc.run('prompt');
const result = await cc.fromFile('file.md', data);
await cc.prompt`Hello ${name}`.launch();

// New way
const result = await claude('prompt');
const result = await claude('file.md', { data });
await claude`Hello ${name}`;
```

## Implementation Details

### Command Building Strategy

The SDK builds Claude CLI commands differently based on the execution mode:

```typescript
// buildCommand() in process.ts
async buildCommand(options: CCOptions & PromptConfig): Promise<string[]> {
  const cmd = ['claude'];
  
  // Handle conversation resumption
  if (options.resume) {
    cmd.push('--resume', options.resume);
  } else if (options.continue) {
    cmd.push('--continue');
  }
  
  // Only add --print for non-interactive modes
  if (options.mode !== 'interactive') {
    cmd.push('--print');
  }
  
  // Add other options...
  return cmd;
}
```

### Prompt Handling

All prompts are piped via stdin to avoid shell escaping issues:

```typescript
// Bad: Passing prompt as argument (shell escaping nightmares)
claude "This prompt has 'quotes' and $variables"

// Good: Piping prompt via stdin (safe)
echo "This prompt has 'quotes' and $variables" | claude --print
```

This is why:
1. Prompts can contain quotes, newlines, and special characters
2. Shell escaping is complex and error-prone
3. Piping via stdin is consistent and safe

### Interactive Mode Process Replacement

Interactive mode uses shell `exec` to truly replace the process:

```typescript
// launchInteractive implementation
const shellCommand = `exec echo '${escapedPrompt}' | exec claude ${escapedArgs}`;
execSync(shellCommand, { stdio: 'inherit', shell: true });
```

Benefits:
- No Node.js wrapper process consuming memory
- Direct signal handling (Ctrl+C, etc.)
- Clean process management for long sessions
- Exit codes go directly to the shell

### Mode Detection Flow

1. User calls `claude()`, `run()`, `stream()`, or `interactive()`
2. Mode is set in options or inferred from function
3. `buildCommand()` checks mode to decide on `--print` flag
4. Execution method varies by mode:
   - run/stream: Use `spawn` with pipes
   - interactive: Use `execSync` with shell exec

## Design Rationale

1. **Function over classes**: Modern JavaScript favors functions and modules over classes
2. **Options over methods**: Single options object is easier to extend and type
3. **CLI familiarity**: Developers who know Claude CLI can immediately use the SDK
4. **Wrapper-friendly**: Easy to build domain-specific abstractions
5. **Tree-shakeable**: Import only what you use
6. **Process efficiency**: Interactive mode replaces process to avoid memory overhead

## Future Compatibility

The design leaves room for future enhancements without breaking changes:

- New options can be added to the options object
- New execution modes can be added as functions
- Return types can be extended with optional fields
- Template literal support can be enhanced