# ChannelCoder

A streamlined SDK and CLI for Claude Code that channels your prompts with powerful features like multi-place variable interpolation, file-based prompts, and streaming support.

## Installation

```bash
# Using npm
npm install channelcoder

# Using bun
bun add channelcoder

# Global CLI installation
npm install -g channelcoder
```

## Quick Start

### SDK Usage

```typescript
import { claude } from 'channelcoder';

// Simple prompt
const result = await claude('What is TypeScript?');

// Template literals
const language = 'TypeScript';
await claude`Explain ${language} in simple terms`;

// File-based prompt with data
await claude('prompts/analyze.md', {
  data: { taskId: 'FEAT-123', priority: 'high' }
});

// With options
await claude('Review this code', {
  tools: ['Read', 'Grep'],
  system: 'You are a code reviewer'
});
```

### CLI Usage

The CLI provides multiple commands for different execution modes:

```bash
# Interactive mode (default) - run Claude interactively
channelcoder interactive prompts/analyze.md -d taskId=FEAT-123

# Run mode - execute and print results
channelcoder run "Explain TypeScript"
channelcoder run prompts/analyze.md --data taskId=FEAT-123

# Stream mode - real-time streaming responses  
channelcoder stream "Write a story"
channelcoder stream prompts/generate.md

# Session management
channelcoder session list                    # List saved sessions
channelcoder session load my-session         # Load and continue a session
channelcoder session remove old-session      # Remove a session

# Worktree management
channelcoder worktree list                   # List git worktrees
channelcoder worktree create feature/new     # Create new worktree
channelcoder worktree remove feature/old     # Remove worktree
```

## Features

### 🎯 Simple Function API

Mirrors Claude CLI's mental model with a simple function:

```typescript
// Inline prompts
await claude('Explain quantum computing');

// File prompts (auto-detected by .md extension)
await claude('prompts/complex-analysis.md');

// With all the options you need
await claude('Debug this issue', {
  tools: ['Read', 'Bash'],
  resume: sessionId,
  maxTurns: 10
});
```

### 🔄 Variable Interpolation

Powerful multi-place variable support:

```typescript
// In inline prompts
await claude('Analyze {code} for {issues}', {
  data: {
    code: 'const x = null',
    issues: ['null safety', 'type errors']
  }
});

// In file prompts
// prompts/review.md:
// Review {prTitle} with focus on {concerns ? concerns : "general quality"}
await claude('prompts/review.md', {
  data: { prTitle: 'Add auth system' }
});
```

### 🌊 Execution Modes

Different modes for different needs:

```typescript
import { claude, interactive, stream, run, detached } from 'channelcoder';

// Run mode (default) - Get complete results programmatically
const result = await claude('Generate tests');
console.log(result.data);

// Stream mode - Real-time responses
for await (const chunk of stream('Write documentation')) {
  process.stdout.write(chunk.content);
}

// Interactive mode - Replace process (like running claude directly)
await interactive('Debug this error');
// ⚠️ Code after interactive() never executes!

// Detached mode - Background execution
const result3 = await detached('Long analysis task', {
  logFile: 'analysis.log'
});
console.log('Started background process:', result3.data?.pid);

// Detached streaming - Real-time background monitoring
const result4 = await detached('Generate comprehensive report', {
  logFile: 'report.log',
  stream: true  // Enables real-time JSON chunks in log file
});
// Monitor with: tail -f report.log | jq -r '.content'
```

### 🌿 Git Worktree Mode

Run Claude in isolated git worktrees for parallel development and clean experimentation:

```typescript
// Simple worktree usage - auto-creates if doesn't exist
await claude('Implement new feature', { 
  worktree: 'feature/auth' 
});

// Standalone worktree function for complex workflows
await worktree('feature/payments', async (wt) => {
  console.log(`Working in: ${wt.path}`);
  await claude('Design payment system');
  await claude('Implement payment processing');
  return 'feature-complete';
}, {
  base: 'main',      // Create from main branch
  cleanup: false     // Keep worktree after execution
});

// Worktree utilities for advanced management
import { worktreeUtils } from 'channelcoder';

// List all worktrees
const worktrees = await worktreeUtils.list();

// Create/remove worktrees manually
await worktreeUtils.create('experiment/new-arch', { base: 'develop' });
await worktreeUtils.remove('feature/old');

// Check worktree existence
if (await worktreeUtils.exists('feature/auth')) {
  console.log('Auth worktree already exists');
}
```

#### Why Use Worktrees?

1. **Parallel Development**: Work on multiple features without stashing/switching
2. **Clean Experiments**: Test risky changes in isolated environments
3. **Context Preservation**: Each worktree maintains its own file state
4. **Session Enhancement**: Combine with sessions for branch-specific conversations

#### Worktree Options

```typescript
interface WorktreeOptions {
  // Branch name (required for creation)
  branch?: string;
  
  // Base branch for new worktree
  base?: string;
  
  // Custom path (auto-generated if not provided)
  path?: string;
  
  // Remove worktree after execution (default: true for temporary)
  cleanup?: boolean;
  
  // Force creation vs. error if exists (default: false - upsert)
  create?: boolean;
}
```

#### Composing Features

Worktrees work seamlessly with other ChannelCoder features:

```typescript
// Worktree + Session
const s = session();
await s.claude('Start OAuth feature', { worktree: 'feature/oauth' });
await s.claude('Add tests'); // Continues in same worktree

// Worktree + Docker
await claude('Test in total isolation', {
  worktree: 'experiment/risky',
  docker: true
});

// Worktree + Streaming
await worktree('feature/docs', async () => {
  for await (const chunk of stream('Generate documentation')) {
    process.stdout.write(chunk.content);
  }
});
```

### 🐳 Docker Mode

Run Claude in an isolated Docker container for enhanced security with dangerous permissions:

```typescript
// Simple Docker mode - auto-detect Dockerfile
await claude('Risky operation', { docker: true });

// Specify Docker image
await claude('Analyze system', { 
  docker: { image: 'my-claude:latest' } 
});

// With custom mounts and environment
await claude('Process data', {
  docker: {
    image: 'claude-sandbox',
    mounts: ['./data:/data:ro'],
    env: { NODE_ENV: 'production' }
  }
});

```

#### Setting Up Docker Mode

1. **Create a Dockerfile** with Claude CLI installed:
```dockerfile
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
```

2. **Build your image**:
```bash
docker build -t my-claude .
```

3. **Use with channelcoder**:
```typescript
await claude('Task', { docker: { image: 'my-claude' } });
```

#### Auto-Detection

When using `docker: true`, channelcoder will:
1. Look for a `Dockerfile` in your project
2. Build an image automatically (with caching)
3. Mount your working directory as `/workspace`

#### Docker Options

```typescript
interface DockerOptions {
  // Auto-detect Dockerfile (default: true)
  auto?: boolean;
  
  // Docker image to use
  image?: string;
  
  // Path to Dockerfile (default: ./Dockerfile)
  dockerfile?: string;
  
  // Additional volume mounts
  mounts?: string[];  // Docker format: "host:container:mode"
  
  // Environment variables
  env?: Record<string, string>;
}
```

## CLI Reference

```bash
channelcoder <command> [options]

Commands:
  run          Execute prompt and exit (print mode) - non-interactive
  interactive  Interactive mode with Claude (default)
  stream       Stream responses in real-time
  session      Manage conversation sessions
  worktree     Manage git worktrees

Global Options:
  -h, --help     Show help
  -v, --version  Show version

Run 'channelcoder <command> --help' for command-specific options
```

### Command Details

#### `channelcoder run [prompt-file] [options]`
Execute a prompt and print the result without interaction.

```bash
Options:
  -p, --prompt <text>      Inline prompt instead of file
  -d, --data <key=value>   Data for interpolation (repeatable)
  -s, --system <prompt>    System prompt (text or .md file)
  -t, --tools <tools>      Allowed tools (e.g., "Read Write")
  --disallowed-tools       Disallowed tools (comma-separated)
  --append-system <text>   Append to system prompt
  --mcp-config <file>      Load MCP servers from JSON file
  --permission-tool <tool> MCP tool for permission prompts
  -r, --resume <id>        Resume conversation by session ID
  -c, --continue           Continue most recent conversation
  --max-turns <n>          Limit agentic turns
  --json                   Output JSON format
  -v, --verbose            Verbose output
```

#### `channelcoder interactive [prompt-file] [options]`
Launch Claude in interactive mode (default command).

```bash
Options: Same as 'run' command
```

#### `channelcoder stream [prompt-file] [options]`
Stream responses in real-time.

```bash
Options: Same as 'run' command
```

#### `channelcoder session <subcommand>`
Manage conversation sessions.

```bash
Subcommands:
  list       List all saved sessions
  load       Load and continue a session
  remove     Remove a saved session
```

#### `channelcoder worktree <subcommand>`
Manage git worktrees for isolated development.

```bash
Subcommands:
  list       List all worktrees
  create     Create a new worktree
  remove     Remove a worktree
  cleanup    Clean up orphaned worktrees
```

## Advanced Features Documentation

For detailed guides on advanced features, see the `/documentation` folder:

- **[Docker Mode Guide](/documentation/guides/docker-mode.md)** - Run Claude in isolated containers with enhanced security
- **[Git Worktree Mode Guide](/documentation/guides/worktree-mode.md)** - Parallel development in isolated git worktrees
- **[Session Management Guide](/documentation/guides/session-management.md)** - Multi-turn conversations with context preservation
- **[Stream Parser SDK Guide](/documentation/guides/stream-parser.md)** - Parse and monitor Claude's streaming output

### Frontmatter Syntax

File-based prompts support YAML frontmatter for configuration. Here are the **actually supported** options:

```yaml
---
# System prompt - Sets the Claude system/assistant prompt
# Can be inline text or a path to a .md/.txt file
systemPrompt: "You are a helpful coding assistant"
# or
systemPrompt: "./system-prompts/analyst.md"

# Append to system prompt
appendSystemPrompt: "Always explain your reasoning"

# Allowed tools - Restrict which tools Claude can use
# These are passed to Claude CLI's --allowedTools flag
allowedTools:
  - "Read"                    # Read files
  - "Write"                   # Write files
  - "Edit"                    # Edit files
  - "Bash"                    # Run any bash command
  - "Bash(git:*)"            # Pattern: only git commands
  - "Bash(npm:test)"         # Specific: only npm test
  - "Grep"                   # Search file contents
  - "WebSearch"              # Search the web

# Disallowed tools - Prevent specific tools
disallowedTools:
  - "Bash(rm:*)"             # No rm commands
  - "Bash(git:push)"         # No git push

# MCP (Model Context Protocol) configuration
mcpConfig: "./mcp-servers.json"
permissionPromptTool: "mcp__auth__prompt"

# Input schema - Validates variables before interpolation
input:
  name: string               # Required string
  age?: number              # Optional number
  tags: string[]            # Array of strings
  config:                   # Nested object
    port: number
    host?: string

# Output schema - Validates Claude's response (SDK only)
output:
  success: boolean
  result:
    type: string
    enum: [feature, bug, chore]  # Enum constraint
  items: 
    - name: string
      done: boolean
---
Your prompt content here...
```

**Note:** The following options are passed via CLI or SDK, not frontmatter:
- `outputFormat` - Use `--json` flag or `claude(prompt, { outputFormat: 'json' })`
- `stream` - Use `--stream` flag or `stream()` function
- `verbose` - Use `--verbose` flag or `claude(prompt, { verbose: true })`
- `timeout` - SDK only: `claude(prompt, { timeout: 30000 })`

#### Frontmatter Validation

The frontmatter is validated using a Zod schema. Invalid keys will cause an error:

```typescript
import { FrontmatterSchema, type Frontmatter } from 'channelcoder';

// Validate frontmatter programmatically
const result = FrontmatterSchema.safeParse({
  systemPrompt: "Valid",
  temperature: 0.7  // Error: unknown key
});

// TypeScript type for frontmatter
const config: Frontmatter = {
  systemPrompt: "Assistant prompt",
  appendSystemPrompt: "Be concise",
  allowedTools: ["Read", "Write"],
  disallowedTools: ["Bash(rm:*)"],
  mcpConfig: "./mcp-servers.json",
  permissionPromptTool: "mcp__auth__prompt",
  input: { name: "string" },
  output: { success: "boolean" }
};
```

#### Schema Definition Format

Schemas are defined using YAML notation that's automatically converted to Zod schemas:

```yaml
---
input:
  name: string              # Basic types: string, number, boolean
  age?: number             # Optional with ?
  tags: string[]           # Arrays with []
  metadata:                # Nested objects
    created: string
    updated?: string
---
```

**Supported types:**
- `string` - Text values
- `number` - Numeric values  
- `boolean` or `bool` - True/false values
- `array` or `type[]` - Arrays
- `object` - Nested objects
- `any` - Any value

**Note:** For programmatic SDK usage, you can also use Zod schemas directly in the validation utilities.

### Examples

#### File-based Prompts

Create a prompt file `analyze.md`:

```yaml
---
input:
  task: string
  details?: boolean
systemPrompt: "You are a helpful analyst"
allowedTools:
  - Read
  - Grep
---
# Analysis for {task}

{details ? "Provide detailed breakdown." : "Summary only."}
```

Run it:

```bash
channelcoder analyze.md -d task="Review PR" -d details=true
```

#### Inline Prompts

```bash
# Simple
channelcoder -p "Explain {concept}" -d concept="quantum computing"

# With tools
channelcoder -p "Find files containing {pattern}" \
   -d pattern="TODO" \
   -t "Read Grep"

# Streaming
channelcoder -p "Write a haiku about {topic}" \
   -d topic="coding" \
   --stream

# Resume conversation
channelcoder --resume abc123 -p "Continue with the implementation"

# Continue last conversation
channelcoder --continue -p "What about error handling?"

# Limit agentic turns
channelcoder analyze.md --max-turns 3

# MCP configuration
channelcoder query.md --mcp-config ./servers.json

# Disallow dangerous tools
channelcoder cleanup.md --disallowed-tools "Bash(rm:*),Bash(git:push)"
```

#### Complex Data

```bash
# Arrays and objects via JSON
channelcoder -p "Process items: {items}" \
   -d 'items=["apple","banana","orange"]'

# Complex nested data
channelcoder -p "Config: {config}" \
   -d 'config={"port":3000,"host":"localhost"}'
```

## SDK Reference

### Basic Usage

```typescript
import { claude } from 'channelcoder';

// Simple prompts
const result = await claude('Explain TypeScript');

// Template literals
const topic = 'async/await';
const result = await claude`Explain ${topic} with examples`;

// File-based prompts
const result = await claude('prompts/analyze.md', {
  data: { taskId: 'FEAT-123' }
});
```

### Options

```typescript
// All available options
const result = await claude('Your prompt', {
  // Data interpolation
  data: { key: 'value' },
  
  // System configuration
  system: 'You are a helpful assistant',
  appendSystem: 'Be concise',
  
  // Tool configuration
  tools: ['Read', 'Write', 'Bash(git:*)'],
  disallowedTools: ['Bash(rm:*)'],
  mcpConfig: './mcp-servers.json',
  permissionTool: 'mcp__auth__prompt',
  
  // Session management
  resume: 'session-id-here',
  continue: true,
  
  // Execution control
  maxTurns: 10,
  mode: 'run', // 'run' | 'stream' | 'interactive'
  includeEvents: true,
  
  // Background execution
  detached: true,        // Run in background
  logFile: 'output.log', // Log file for detached mode
  stream: true,          // Enable real-time streaming in detached mode
  
  // Other
  verbose: true,
  outputFormat: 'json',
  timeout: 60000
});
```

### Streaming

```typescript
import { stream } from 'channelcoder';

// Stream responses
for await (const chunk of stream('Generate a story')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

### Error Handling

```typescript
const result = await claude('prompt.md', { data });

if (!result.success) {
  console.error('Error:', result.error);
  if (result.warnings) {
    console.warn('Warnings:', result.warnings);
  }
}

// Type-safe error handling
if (result.warnings?.includes('max turns reached')) {
  console.log('Hit maximum turn limit');
}
```

### Interactive Mode

```typescript
import { interactive } from 'channelcoder';

// Launch Claude interactively (replaces current process)
await interactive('Help me debug this issue');

// Code below this line will NEVER execute!
// The process is replaced by Claude using shell exec
```

**Important:** Interactive mode completely replaces your Node.js process with Claude:
- No Node.js parent process remains in memory
- Claude gets direct terminal control
- Exit codes go directly to the shell
- Perfect for long Claude sessions without memory overhead

### Background Execution & Real-time Monitoring

ChannelCoder supports background execution with real-time monitoring capabilities:

```typescript
import { detached, session } from 'channelcoder';

// Basic background execution
const result = await detached('Analyze large codebase', {
  logFile: 'analysis.log'
});
console.log('Background process started with PID:', result.data?.pid);

// Real-time streaming to log file
const result2 = await detached('Generate comprehensive report', {
  logFile: 'report.log',
  stream: true  // Enables real-time JSON streaming
});

// Monitor in real-time with Unix tools
// tail -f report.log | jq -r '.content'          # See content
// tail -f report.log | jq -r '.type'             # See chunk types
// watch -n 1 "wc -l report.log"                  # Monitor progress
```

**Session Background Execution:**

```typescript
// Session with real-time file updates
const s = session({ 
  autoSave: true  // Session file updates in real-time
});

// Background execution with session context
await s.detached('Long-running analysis', {
  logFile: 'session-output.log',
  stream: true
});

// Monitor both Claude output AND session state
// tail -f session-output.log | jq -r '.content'   # Claude output
// watch -n 1 cat ~/.channelcoder/sessions/my-session.json  # Session state
```

### Stream Parser SDK

ChannelCoder includes a powerful Stream Parser SDK for parsing Claude's stream-json output from detached sessions and log files:

```typescript
import { parseLogFile, monitorLog, streamParser } from 'channelcoder';

// Parse a complete log file
const parsed = await parseLogFile('session.log');
console.log(parsed.content);        // All assistant messages
console.log(parsed.totalCost);      // Total cost
console.log(parsed.events.length);  // Number of events

// Monitor a log file in real-time
const cleanup = monitorLog('active.log', (event) => {
  if (streamParser.isAssistantEvent(event)) {
    console.log('Claude:', streamParser.extractAssistantText(event));
  } else if (streamParser.isToolUseEvent(event)) {
    console.log('Tool used:', event.tool);
  } else if (streamParser.isResultEvent(event)) {
    console.log('Completed! Cost:', event.cost_usd);
  }
});

// Clean up when done
cleanup();

// Low-level parsing
import { parseStreamEvent, eventToChunk } from 'channelcoder/streamParser';

const line = '{"type":"assistant","message":{...}}';
const event = parseStreamEvent(line);
const chunk = eventToChunk(event);
```

**Type Guards for Event Handling:**

```typescript
import { 
  isSystemEvent, 
  isAssistantEvent, 
  isResultEvent,
  isToolUseEvent,
  isErrorEvent 
} from 'channelcoder';

// Type-safe event processing
function processEvent(event: ClaudeEvent) {
  if (isAssistantEvent(event)) {
    const text = streamParser.extractAssistantText(event);
    console.log('Assistant:', text);
  } else if (isToolUseEvent(event)) {
    console.log('Tool:', event.tool, event.input);
  } else if (isResultEvent(event)) {
    if (event.subtype === 'error') {
      console.error('Failed:', event.error);
    } else {
      console.log('Success! Cost: $', event.cost_usd);
    }
  }
}
```

See `examples/task-monitor-tui.ts` for a complete real-time monitoring TUI built with the Stream Parser SDK.

### Session Management

ChannelCoder provides built-in session management for maintaining conversation context:

```typescript
import { session } from 'channelcoder';

// Create a new session with auto-save
const s = session({ autoSave: true });

// Use like normal, but with automatic context tracking
await s.claude('What is TypeScript?');
await s.claude('Show me an example'); // Automatically continues conversation

// Save session for later
await s.save('learning-typescript');

// Load and continue a saved session
const saved = await session.load('learning-typescript');
await saved.claude('What about generics?');

// List all saved sessions
const sessions = await session.list();
// [{ name: 'learning-typescript', messageCount: 3, lastActive: Date, ... }]

// Access session data
console.log(s.id());         // Current session ID
console.log(s.messages());   // Conversation history
```

**CLI Session Support:**

```bash
# Start a new session
channelcoder prompts/debug.md --session my-debug

# Continue a session
channelcoder prompts/continue.md --load-session my-debug

# List all sessions
channelcoder --list-sessions
```

**Session-Required Prompts:**

```yaml
---
session:
  required: true
systemPrompt: "You are debugging an ongoing issue"
---
Continue investigating the error we discussed.
```

**Manual Session Management (without session wrapper):**

```typescript
// Resume a specific session by ID
await claude('Continue our discussion', {
  resume: 'session-id-here'
});

// Continue most recent session
await claude('Continue where we left off', {
  continue: true
});
```

## Prompt File Format

ChannelCoder uses Markdown files with YAML frontmatter:

```yaml
---
# Input validation (optional)
input:
  name: string
  age?: number
  tags: string[]

# Output schema (optional)
output:
  success: boolean
  message: string

# Claude options
systemPrompt: "path/to/system.md"  # or inline text
allowedTools:
  - Read
  - Write
  - "Bash(git:*)"  # With patterns
---

# Your prompt with {name} interpolation

Age: {age ? age : "not specified"}

Tags: {tags}
```

## Requirements

- Claude Code CLI installed and configured
- Node.js 18+ or Bun runtime

## Tips & Tricks

### 1. Tool Patterns

Allow specific command patterns:
```bash
channelcoder prompt.md -t "Bash(git:*) Read Write"
```

### 2. Conditional Content

Use JavaScript expressions in templates:
```typescript
const isDev = true;
const items = ['a', 'b', 'c'];

await claude`
  ${isDev ? "Include debug info" : ""}
  Process ${items.length} items
`;
```

### 3. System Prompts

Can be inline or file paths:
```bash
# Inline
channelcoder -p "..." -s "Be concise"

# From file
channelcoder -p "..." -s "prompts/systems/expert.md"
```

### 4. Background Monitoring

Perfect for long-running tasks:
```bash
# Start background streaming process
channelcoder analysis.md --detached --stream --log analysis.log

# Monitor real-time progress (Unix composable)
tail -f analysis.log | jq -r '.content'           # Content only
tail -f analysis.log | jq -r 'select(.type=="tool_use").tool'  # Tool usage
watch -n 1 "grep -c content analysis.log"         # Progress counter
```

### 5. JSON Output

Perfect for automation:
```bash
result=$(cc prompt.md --json)
success=$(echo $result | jq -r '.success')
```

## Examples

Check out the `/examples` directory for:
- `basic-usage.ts` - Simple examples to get started
- `file-based-usage.ts` - Using file-based prompts
- `launch-modes.ts` - Different execution modes
- `detached-streaming.ts` - Background execution with real-time monitoring
- `task-monitor-tui.ts` - **NEW** Real-time TUI using Stream Parser SDK
- `demo-features.ts` - Feature showcase (no execution)
- `release.ts` - Real-world release automation

Run examples:
```bash
bun run example:quick     # Run basic examples
bun run examples/basic-usage.ts
bun run examples/launch-modes.ts run
bun run examples/release.ts
```

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/davidpp/channelcoder](https://github.com/davidpp/channelcoder)

---

*Named after Claude Shannon, the father of information theory, ChannelCoder channels your prompts to Claude with maximum signal and minimum noise.*