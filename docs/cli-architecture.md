# CLI Architecture

## Overview

The ChannelCoder CLI provides a command-line interface that maps 1:1 with the SDK's core functions. Built with Stricli, it offers type-safe command parsing with proper subcommands for each execution mode.

## Design Principles

1. **1:1 SDK Mapping**: Each CLI command maps directly to an SDK function
2. **Type-Safe Command Parsing**: Uses Stricli for robust, typed CLI handling
3. **Consistent Flag Structure**: Shared flags across commands for consistency
4. **Progressive Disclosure**: Simple usage stays simple, advanced features available when needed
5. **Unix Philosophy**: Composable with pipes, scripts, and other tools

## Architecture Overview

### Command Structure
```
channelcoder
├── run          # Execute and exit (SDK: run())
├── interactive  # Launch Claude UI (SDK: interactive()) - DEFAULT
├── stream       # Real-time streaming (SDK: stream())
├── session      # Session management
│   ├── list
│   ├── load
│   └── remove
└── worktree     # Git worktree management
    ├── list
    ├── create
    ├── remove
    └── cleanup
```

### File Structure
```
src/cli/
├── index.ts              # Stricli app definition & routing
├── commands/
│   ├── run.ts           # Print mode execution
│   ├── interactive.ts   # Interactive UI mode
│   ├── stream.ts        # Streaming mode
│   ├── session/         # Session subcommands
│   └── worktree/        # Worktree subcommands
├── flags/               # Shared flag definitions
├── utils.ts            # CLI utilities
├── context.ts          # Command context builder
└── types.ts            # TypeScript types
```

## Core Components

### 1. Command Routing (index.ts)

Uses Stricli's type-safe routing:

```typescript
const routes = buildRouteMap({
  routes: {
    run: runCommand,
    interactive: interactiveCommand,
    stream: streamCommand,
    session: sessionCommand,
    worktree: worktreeCommand,
  },
  aliases: {
    i: 'interactive',  // Short alias
  },
  defaultCommand: 'interactive',  // Default when no command specified
  docs: {
    brief: 'A streamlined SDK and CLI for Claude Code',
  },
});
```

### 2. Shared Flags (flags/index.ts)

Organized by category for reuse across commands:

```typescript
// Data input flags
export const dataFlags = {
  data: {
    kind: 'parsed' as const,
    variadic: true,
    parse: (value: string) => value,
    brief: 'Data for template interpolation (key=value)',
    optional: true,
  },
  dataStdin: {
    kind: 'boolean' as const,
    default: false,
    brief: 'Read JSON data from stdin',
  },
};

// Tool configuration flags
export const toolFlags = {
  tools: {
    kind: 'parsed' as const,
    parse: (value: string) => value,
    brief: 'Allowed tools (comma or space separated)',
    optional: true,
  },
  // ...
};
```

### 3. Command Implementation Pattern

Each command follows a consistent pattern:

```typescript
export const runCommand = buildCommand({
  docs: {
    brief: 'Execute prompt and exit (print mode)',
    customUsage: [
      '"Quick calculation: 2+2"',
      'analyze.md -d file=src/index.ts',
    ],
  },
  async func(this: CommandContext, flags: RunFlags, promptFile?: string) {
    // 1. Parse data from flags
    const data = await parseData(flags);
    
    // 2. Build options for SDK
    const options = buildOptions(flags, data);
    
    // 3. Get prompt source
    const promptSource = promptFile || '';
    
    // 4. Call SDK function
    await run(promptSource, options);
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [{
        brief: 'Prompt text or file path',
        parse: String,
        optional: true,
      }],
    },
    flags: {
      ...dataFlags,
      ...toolFlags,
      ...executionFlags,
      // Command-specific flags
    },
    aliases: {
      d: 'data',
      t: 'tools',
      v: 'verbose',
      // ...
    },
  },
});
```

### 4. Data Processing (utils.ts)

Handles complex flag parsing:

```typescript
// Parse key=value pairs with smart type detection
export async function parseDataArgs(dataArgs: string[]): Promise<InterpolationData> {
  const data: InterpolationData = {};
  
  for (const arg of dataArgs) {
    const [key, ...valueParts] = arg.split('=');
    const value = valueParts.join('=');
    
    // Try JSON first
    try {
      data[key] = JSON.parse(value);
    } catch {
      // Smart type detection
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (/^-?\d+$/.test(value)) data[key] = parseInt(value);
      else data[key] = value;  // String fallback
    }
  }
  
  return data;
}

// Parse tool patterns
export function parseTools(toolString: string): string[] {
  return toolString.includes(',') 
    ? toolString.split(',').map(t => t.trim())
    : toolString.split(/\s+/).filter(t => t);
}
```

## Command Details

### 1. Run Command
- **SDK Function**: `run()`
- **Purpose**: Execute prompt and exit
- **Key Features**: 
  - Best for scripting and automation
  - Returns results to stdout
  - No interactive UI

```bash
channelcoder run "What is 2+2?"
channelcoder run analyze.md -d file=src/index.ts
```

### 2. Interactive Command (Default)
- **SDK Function**: `interactive()`
- **Purpose**: Launch Claude's interactive UI
- **Key Features**:
  - Full Claude Code experience
  - Session support
  - Worktree integration

```bash
channelcoder "Help me debug this"  # Default to interactive
channelcoder interactive refactor.md --session feature-work
```

### 3. Stream Command
- **SDK Function**: `stream()`
- **Purpose**: Real-time streaming output
- **Key Features**:
  - Streaming responses
  - JSON parsing option
  - Good for real-time processing

```bash
channelcoder stream "Analyze this data" --parse
channelcoder stream generate.md | process-output
```

## Feature Support Matrix

| Feature | Run | Interactive | Stream |
|---------|-----|-------------|--------|
| Prompts | ✓ | ✓ | ✓ |
| Data Interpolation | ✓ | ✓ | ✓ |
| System Prompts | ✓ | ✓ | ✓ |
| Tool Control | ✓ | ✓ | ✓ |
| Sessions | ✓ | ✓ | ✗ |
| Docker | ✓ | ✓ | ✗ |
| Worktrees | ✓ | ✓ | ✗ |
| MCP Config | ✓ | ✓ | ✓ |
| JSON Output | ✗ | ✗ | ✓ |

## Usage Examples

### Basic Usage
```bash
# Interactive mode (default)
channelcoder "Quick question"

# Run mode for scripting
channelcoder run "Calculate 2+2"

# Stream mode for real-time
channelcoder stream "Analyze logs" --parse
```

### With Data Interpolation
```bash
# Single data value
channelcoder run prompt.md -d taskId=FEAT-123

# Multiple values with types
channelcoder run generate.md -d name=Button -d props='["onClick","disabled"]'

# From stdin
echo '{"config": {"theme": "dark"}}' | channelcoder run --data-stdin
```

### Session Management
```bash
# Start new session
channelcoder interactive --session feature-work

# Continue session
channelcoder interactive --load-session feature-work

# With run mode
channelcoder run test.md --session testing
```

### Advanced Features
```bash
# Docker mode
channelcoder interactive --docker --docker-mount ./data:/data

# Worktree mode
channelcoder interactive -w feature/auth --worktree-base main

# Tool restrictions
channelcoder run -t "Read Write" --disallowed-tools "Bash(rm:*)"

# MCP configuration
channelcoder run --mcp-config servers.json
```

## Error Handling

The CLI provides user-friendly error messages:

```typescript
catch (error) {
  if (error.message.includes('ENOENT')) {
    console.error('❌ Error: File not found');
    console.error('💡 Make sure the file exists');
  } else if (error.message.includes('Input validation failed')) {
    console.error(`❌ ${error.message}`);
    console.error('💡 Check that all required fields are provided with -d');
  }
  // ...
}
```

## Type Safety

Stricli ensures type safety throughout:

1. **Flag Types**: Enforced at compile time
2. **Command Parameters**: Typed positional arguments
3. **Context**: Typed command context
4. **Autocomplete**: Full TypeScript support

## Testing

Each command can be tested independently:

```bash
# Test commands directly
bun test src/cli/commands/run.test.ts
bun test src/cli/commands/interactive.test.ts

# Integration tests
bun test test/cli-e2e.test.ts
```

## Future Considerations

1. **Additional Commands**:
   - `channelcoder detached` - Background execution
   - `channelcoder validate` - Validate prompt files

2. **Enhanced Features**:
   - Config file support (`.channelcoderrc`)
   - Shell completion scripts
   - Interactive prompts for missing data

3. **Performance**:
   - Lazy load command implementations
   - Minimize startup time
   - Efficient flag parsing

## Migration from Single-File Design

The migration to Stricli brought several benefits:

1. **Better Organization**: Commands in separate files
2. **Type Safety**: Compile-time flag checking
3. **Subcommands**: Proper command hierarchy
4. **Help System**: Auto-generated, well-organized help
5. **Maintainability**: Easier to extend and test

While the single-file design was elegant for a simple CLI, Stricli provides the structure needed as the CLI grows in complexity.