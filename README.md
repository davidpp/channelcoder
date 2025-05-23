# ChannelCoder

A streamlined SDK and CLI for Claude Code that channels your prompts with powerful features like multi-place variable interpolation, schema validation, and streaming support.

## Installation

```bash
# Using npm
npm install -g channelcoder

# Using bun
bun add -g channelcoder

# For project-specific installation
npm install channelcoder
```

## Quick Start

### CLI Usage

```bash
# Run a prompt file
channelcoder prompts/analyze.md -d taskId=FEAT-123

# Or use the short alias
cc prompts/analyze.md -d taskId=FEAT-123

# Inline prompt
cc -p "Summarize this: ${text}" -d text="Hello world"

# Stream responses
cc -p "Tell me a story" --stream
```

### SDK Usage

```typescript
import { cc } from 'channelcoder';

// Simple prompt
const result = await cc.prompt`
  Analyze task ${taskId} with context: ${context}
`.run();

// From a file
const analysis = await cc.fromFile('prompts/analyze.md', {
  taskId: 'FEAT-123',
  context: 'Implementation details'
});
```

## Features

### 🔄 Multi-place Variable Interpolation

Unlike Claude's single-place commands, ChannelCoder supports variables anywhere:

```typescript
const result = await cc.prompt`
  Task: ${task}
  Priority: ${priority}
  ${urgent ? "⚠️ URGENT: Handle immediately" : ""}
`.run();
```

### ✅ Schema Validation

Built-in Zod validation for inputs and outputs:

```yaml
---
input:
  taskId: string
  priority?: string
output:
  success: boolean
  result: string
---
Analyze task ${taskId}...
```

### 🌊 Streaming Support

Real-time streaming for long responses:

```typescript
for await (const chunk of cc.stream(cc.prompt`Generate report`)) {
  console.log(chunk.content);
}
```

### 🛠️ Fluent Builder API

```typescript
const result = await cc.prompt`Generate ${type}`
  .withSystemPrompt('Be concise')
  .withTools(['Read', 'Write'])
  .run();
```

## CLI Reference

```bash
channelcoder [prompt-file] [options]
# or
cc [prompt-file] [options]

Options:
  -p, --prompt <text>      Inline prompt instead of file
  -d, --data <key=value>   Data for interpolation (repeatable)
  -s, --system <prompt>    System prompt (text or .md file)
  -t, --tools <tools>      Allowed tools (e.g., "Read Write")
  --stream                 Stream output
  --json                   JSON output only
  -v, --verbose            Verbose output
  -h, --help               Show help
```

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
# Analysis for ${task}

${details ? "Provide detailed breakdown." : "Summary only."}
```

Run it:

```bash
cc analyze.md -d task="Review PR" -d details=true
```

#### Inline Prompts

```bash
# Simple
cc -p "Explain ${concept}" -d concept="quantum computing"

# With tools
cc -p "Find files containing ${pattern}" \
   -d pattern="TODO" \
   -t "Read Grep"

# Streaming
cc -p "Write a haiku about ${topic}" \
   -d topic="coding" \
   --stream
```

#### Complex Data

```bash
# Arrays and objects via JSON
cc -p "Process items: ${items}" \
   -d 'items=["apple","banana","orange"]'

# Via stdin
echo '{"config": {"port": 3000}}' | cc prompt.md --data-stdin
```

## SDK Reference

### Basic Usage

```typescript
import { cc } from 'channelcoder';

// Template literal prompts
const result = await cc.prompt`
  Your prompt here with ${variables}
`.run();

// File-based prompts
const result = await cc.fromFile('path/to/prompt.md', {
  variable: 'value'
});
```

### Validation

```typescript
import { z } from 'zod';

// Define schemas
const outputSchema = z.object({
  summary: z.string(),
  score: z.number()
});

// With validation
const result = await cc.prompt`Analyze this`
  .withSchema(outputSchema)
  .run();

// Validate results
const validated = cc.validate(result, outputSchema);
if (validated.success) {
  console.log(validated.data.summary);
}
```

### Streaming

```typescript
// Async iteration
for await (const chunk of cc.stream(cc.prompt`Tell a story`)) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

### Error Handling

```typescript
const result = await cc.fromFile('prompt.md', data);

if (!result.success) {
  console.error('Error:', result.error);
  if (result.warnings) {
    console.warn('Warnings:', result.warnings);
  }
}
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

# Your prompt with ${name} interpolation

Age: ${age || "not specified"}

Tags: ${tags}
```

## Requirements

- Claude Code CLI installed and configured
- Node.js 18+ or Bun runtime

## Tips & Tricks

### 1. Tool Patterns

Allow specific command patterns:
```bash
cc prompt.md -t "Bash(git:*) Read Write"
```

### 2. Conditional Content

Use JavaScript expressions in templates:
```typescript
cc.prompt`
  ${isDev ? "Include debug info" : ""}
  Process ${items.length} items
`
```

### 3. System Prompts

Can be inline or file paths:
```bash
# Inline
cc -p "..." -s "Be concise"

# From file
cc -p "..." -s "prompts/systems/expert.md"
```

### 4. JSON Output

Perfect for automation:
```bash
result=$(cc prompt.md --json)
success=$(echo $result | jq -r '.success')
```

## Examples

Check out the `/examples` directory for:
- `quick-start.ts` - Simple examples to get started
- `release.ts` - Real-world release automation example
- `root-cause-analysis.ts` - Debug issues by tracing through codebases
- Example prompt templates with schemas

Run examples:
```bash
bun run examples/quick-start.ts
bun run examples/release.ts
bun run examples/root-cause-analysis.ts
```

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/davidpp/channelcoder](https://github.com/davidpp/channelcoder)

---

*Named after Claude Shannon, the father of information theory, ChannelCoder channels your prompts to Claude with maximum signal and minimum noise.*