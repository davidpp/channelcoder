# AllowedTools Guide for ChannelCoder

This guide explains how to use the AllowedTools feature with ChannelCoder, including support for MCP (Model Context Protocol) tools.

## Overview

The AllowedTools feature restricts which tools Claude can use during a session. This is useful for:
- Security: Limiting tool access in production environments
- Focus: Ensuring Claude uses only specific tools for a task
- MCP Integration: Enabling specific MCP server tools

## Basic Usage

### SDK Usage

Use the `tools` option (not `allowedTools`):

```typescript
import { claude } from 'channelcoder';

// Allow only specific tools
const result = await claude('List files and read README', {
  tools: ['LS', 'Read']
});

// With MCP tools
const result2 = await claude('Use scopecraft to list tasks', {
  tools: ['mcp__scopecraft__task_list', 'mcp__scopecraft__task_get'],
  mcpConfig: '~/.claude/claude_desktop_config.json'
});
```

### CLI Usage

```bash
# Standard tools
channelcoder prompt.md -t "LS Read Write"

# MCP tools
channelcoder prompt.md -t "mcp__scopecraft__task_list" --mcp-config ~/.claude/claude_desktop_config.json
```

### File-based Prompts

In your prompt file's frontmatter:

```yaml
---
allowedTools:
  - LS
  - Read
  - mcp__scopecraft__task_list
  - mcp__scopecraft__task_get
mcpConfig: ~/.claude/claude_desktop_config.json
---

Your prompt content here...
```

## Important Notes

### 1. Option Name Mapping

In the SDK, use `tools` (not `allowedTools`):
- ✅ Correct: `{ tools: ['LS', 'Read'] }`
- ❌ Wrong: `{ allowedTools: ['LS', 'Read'] }`

In frontmatter, use `allowedTools`:
- ✅ Correct: `allowedTools: ['LS', 'Read']`

### 2. MCP Tools Format

MCP tools follow the pattern: `mcp__<server>__<tool>`

Examples:
- `mcp__scopecraft__task_list`
- `mcp__github__create_issue`
- `mcp__filesystem__read_file`

### 3. Tool Patterns

You can use patterns with some tools:

```typescript
// Allow git commands only
{ tools: ['Bash(git:*)'] }

// Allow specific file operations
{ tools: ['Read(*.ts)', 'Write(src/**)'] }
```

### 4. Session Support

AllowedTools work with all execution modes:

```typescript
// Interactive
await interactive('Help me debug', { tools: ['Read', 'Grep'] });

// Detached
await detached('Analyze codebase', {
  tools: ['Read', 'Grep', 'mcp__scopecraft__task_list'],
  logFile: 'analysis.log'
});

// Session
const s = session();
await s.claude('Start analysis', { tools: ['Read'] });
```

## Debugging

### 1. Verify Command Generation

Use dry-run mode to check the generated command:

```typescript
const result = await claude('Test prompt', {
  tools: ['LS'],
  dryRun: true
});

console.log(result.data.args);
// Should include: ['--allowedTools', 'LS']
```

### 2. Check Available Tools

In the system event of stream-json logs:

```bash
cat session.log | jq -r 'select(.type=="system") | .tools'
```

### 3. Monitor Tool Usage

```typescript
import { monitorLog, streamParser } from 'channelcoder';

monitorLog('session.log', (event) => {
  if (streamParser.isAssistantEvent(event)) {
    event.message?.content?.forEach(content => {
      if (content.type === 'tool_use') {
        console.log('Tool used:', content.name);
      }
    });
  }
});
```

## Common Issues

### Issue: MCP tools not available

**Solution**: Ensure you're passing the MCP config:

```typescript
{
  tools: ['mcp__scopecraft__task_list'],
  mcpConfig: '~/.claude/claude_desktop_config.json'  // Required!
}
```

### Issue: Tools option not working

**Solution**: Use `tools` in SDK, not `allowedTools`:

```typescript
// ✅ Correct
await claude('...', { tools: ['LS'] });

// ❌ Wrong (won't be passed to CLI)
await claude('...', { allowedTools: ['LS'] });
```

### Issue: Tool patterns not working

**Solution**: Quote patterns properly:

```bash
# CLI - use quotes
channelcoder prompt.md -t "Bash(git:*) Read"

# SDK - array format
{ tools: ['Bash(git:*)', 'Read'] }
```

## Examples

### Example 1: Restrict to Read-Only Operations

```typescript
const result = await claude('Analyze this codebase', {
  tools: ['Read', 'Grep', 'LS', 'Glob'],
  // No Write, Edit, or Bash allowed
});
```

### Example 2: MCP-Only Session

```typescript
const result = await claude('Work with project tasks', {
  tools: [
    'mcp__scopecraft__task_list',
    'mcp__scopecraft__task_get',
    'mcp__scopecraft__task_update'
  ],
  mcpConfig: '~/.claude/claude_desktop_config.json'
});
```

### Example 3: Mixed Standard and MCP Tools

```yaml
---
allowedTools:
  - Read              # Read files
  - Write             # Write files
  - mcp__scopecraft__task_list  # List tasks via MCP
  - mcp__github__create_issue    # Create GitHub issues
mcpConfig: ~/.claude/claude_desktop_config.json
---

Implement the feature and create a GitHub issue for tracking.
```

## Testing

Run the provided test scripts to verify AllowedTools functionality:

```bash
# Test standard tools
bun run test-allowed-tools.ts

# Test MCP tools
bun run test-mcp-tools.ts
```

These tests will:
1. Verify command generation (dry-run)
2. Test real execution with monitoring
3. Confirm tool restrictions are applied