# ChannelCoder Examples

This directory contains practical examples demonstrating ChannelCoder's features.

## Prerequisites

All examples require Claude CLI to be installed and configured:
- Install: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- The examples will check for Claude CLI and warn if it's not available

**Note**: Session examples make real API calls to Claude. Use `--dry-run` flag where available to see commands without execution.

## Release Analysis Example

A real-world example showing how to automate release version analysis using git history.

### Files

- `release-analysis.md` - Prompt template with:
  - Input schema validation
  - Output schema for structured responses
  - Multiple variable interpolation
  - Conditional content based on input
  - System prompt for consistency

- `release.ts` - Script that:
  - Gathers git information (commits, tags, changes)
  - Passes multiple variables to the prompt
  - Validates responses with Zod schemas
  - Shows both file-based and inline prompt usage

### Running the Example

```bash
# Make sure you're in a git repository
cd your-project

# Run the analysis
bun run examples/release.ts

# Or validate a specific target version
bun run examples/release.ts v2.0.0
```

### What It Demonstrates

1. **Multi-variable Interpolation**:
   ```yaml
   currentVersion: "1.2.3"
   lastTag: "v1.2.0"
   commits: "git log output..."
   fileChanges: "git diff stats..."
   ```

2. **Conditional Content**:
   ```markdown
   ${targetVersion ? "Validate target: ${targetVersion}" : ""}
   ```

3. **Schema Validation**:
   - Input validation ensures all required data is provided
   - Output validation guarantees structured responses

4. **Real-world Use Case**:
   - Analyzes git history
   - Recommends semantic version bumps
   - Provides reasoning and confidence levels

### Example Output

```
🚀 Release Analysis Example

📊 Current version: 1.2.3
🏷️  Last tag: v1.2.0
📝 Analyzing 15 commits...

🔍 Running release analysis...

✅ Analysis Complete!

📌 Recommended Version: 1.3.0
📊 Change Type: MINOR
🎯 Confidence: HIGH
💥 Breaking Changes: No

💡 Reasoning: Added new features without breaking existing functionality

🌟 Highlights:
   - Added streaming support for real-time responses
   - Implemented schema validation with Zod
   - New fluent builder API for prompts
```

## Root Cause Analysis Example

A debugging tool that demonstrates systematic error analysis using code tracing.

### Files

- `root-cause-analysis.md` - Advanced prompt template featuring:
  - Read-only tool restrictions for safety
  - Multiple search and analysis tools (rg, grep, git blame)
  - Structured output for call traces
  - Hypothesis generation

- `root-cause-analysis.ts` - Interactive debugging script that:
  - Analyzes different types of errors
  - Traces function calls through codebases
  - Generates fix recommendations
  - Supports custom error analysis

### Running the Example

```bash
# Run demo scenarios
bun run examples/root-cause-analysis.ts

# Analyze a custom error
bun run examples/root-cause-analysis.ts --custom "TypeError: x is not a function" "function.*x"

# Quick pattern search
bun run examples/root-cause-analysis.ts --search "TODO|FIXME"
```

### What It Demonstrates

1. **Safe Tool Usage**:
   ```yaml
   allowedTools:
     - "Bash(rg:*)"      # ripgrep for searching
     - "Bash(git log:*)" # git history
     - Read              # file reading
     # Note: No Write or Edit tools
   ```

2. **Complex Analysis Flow**:
   - Search for error patterns
   - Trace call stacks
   - Examine git history
   - Form hypotheses
   - Suggest fixes

3. **Structured Debugging Output**:
   ```json
   {
     "rootCause": {
       "file": "src/service.ts",
       "line": 42,
       "description": "Null check missing"
     },
     "callTrace": [...],
     "hypothesis": "...",
     "suggestedFix": "..."
   }
   ```

## Session Management

ChannelCoder v2.1+ includes built-in session management for maintaining conversation context across multiple interactions.

### Key Features

1. **Automatic Context Tracking**: Each message is linked with the previous conversation
2. **Session Persistence**: Save and load sessions for multi-day workflows  
3. **Session Chaining**: Claude returns new session IDs with each response
4. **Full Integration**: Works with all ChannelCoder features (templates, validation, tools)

### Basic Session Usage

```typescript
import { session } from 'channelcoder';

// Create a new session
const s = session();

// Have a conversation
await s.claude('What is TypeScript?');
await s.claude('Show me an example'); // Remembers previous context!

// Save for later
await s.save('learning-session');

// Load and continue
const saved = await session.load('learning-session');
await saved.claude('What about generics?'); // Continues where you left off
```

### Session Use Cases

1. **Iterative Development**: Build features step-by-step over multiple days
2. **Code Reviews**: Review multiple files while maintaining context
3. **Debugging Sessions**: Track down issues with full conversation history
4. **Learning Workflows**: Progressive learning with context preservation
5. **Team Collaboration**: Share sessions with team members

### CLI Session Support

```bash
# Start a new session
channelcoder prompts/task.md --session project-x

# Continue later
channelcoder prompts/continue.md --load-session project-x

# List all sessions
channelcoder --list-sessions
```

## Creating Your Own Examples

1. **Define a Prompt File** with frontmatter:
   ```yaml
   ---
   input:
     param1: string
     param2?: boolean
   output:
     result: string
   systemPrompt: "You are a helpful assistant"
   allowedTools: [Read, Write]
   ---
   Process {param1}...
   ```

2. **Use in Your Script**:
   ```typescript
   import { claude } from 'channelcoder';
   
   const result = await claude('your-prompt.md', {
     data: {
       param1: 'value',
       param2: true
     }
   });
   
   // Input validation happens automatically if schema in frontmatter
   if (result.success) {
     console.log(result.data); // Typed based on output schema
   }
   ```

3. **Different Execution Modes**:
   ```typescript
   // Streaming
   for await (const chunk of stream('your-prompt.md', { data })) {
     console.log(chunk.content);
   }
   
   // Interactive (replaces current process!)
   await interactive('your-prompt.md', { data });
   // ⚠️ Code after interactive() never executes!
   ```

## All Example Files

### Core Examples

1. **`basic-usage.ts`** - Simple examples showing core functionality
   ```bash
   bun run examples/basic-usage.ts
   ```

2. **`file-based-usage.ts`** - File-based prompts with frontmatter and validation
   ```bash
   bun run examples/file-based-usage.ts
   ```

3. **`launch-modes.ts`** - Different execution modes (run, stream, interactive)
   ```bash
   bun run examples/launch-modes.ts [mode]
   # Modes: run, stream, interactive, template, file, all
   ```

### New in v2.0.0

4. **`interactive-demo.ts`** ⭐ - Shows process replacement behavior
   ```bash
   bun run examples/interactive-demo.ts
   # Or with context:
   bun run examples/interactive-demo.ts "debugging TypeScript"
   ```

5. **`dry-run-demo.ts`** ⭐ - Generate CLI commands without execution
   ```bash
   bun run examples/dry-run-demo.ts
   ```

### Session Management Examples ⭐ NEW

6. **`session-usage.ts`** - Comprehensive session management guide
   ```bash
   bun run examples/session-usage.ts
   ```
   Shows: Basic sessions, saving/loading, listing, CLI integration

7. **`debug-session.ts`** - Multi-step debugging workflow
   ```bash
   bun run examples/debug-session.ts
   ```
   Shows: Error tracking across messages, session persistence

8. **`session-demo-live.ts`** - Live demo with real Claude CLI
   ```bash
   bun run examples/session-demo-live.ts [--dry-run]
   ```
   Shows: Real session ID tracking, conversation continuity

9. **`iterative-development.ts`** ⭐ - Build features iteratively
   ```bash
   bun run examples/iterative-development.ts
   ```
   Shows: Multi-day development workflow, context preservation

10. **`code-review-session.ts`** ⭐ - Conduct thorough code reviews
    ```bash
    bun run examples/code-review-session.ts
    ```
    Shows: Review multiple files, track issues, follow-up on fixes

### Advanced Examples

11. **`demo-features.ts`** - Feature showcase (no execution)
    ```bash
    bun run examples/demo-features.ts
    ```

12. **`release.ts`** - Real-world release automation
    ```bash
    bun run examples/release.ts [version]
    ```

### Quick Start

Run multiple examples at once:
```bash
# Run basic examples
bun run example:quick

# Run all non-interactive examples
bun run examples/launch-modes.ts all
```