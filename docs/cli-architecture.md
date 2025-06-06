# CLI Architecture

## Overview

The ChannelCoder CLI is a streamlined command-line interface that provides direct access to Claude Code with powerful template processing, session management, and execution modes. It follows a simple, single-file design using Node.js's built-in utilities.

## Design Principles

1. **No Framework Dependencies**: Uses Node.js's built-in `parseArgs` utility
2. **Single File Simplicity**: All CLI logic in one `src/cli.ts` file
3. **Mirror SDK Capabilities**: CLI flags map directly to SDK options
4. **Progressive Disclosure**: Simple usage stays simple, advanced features available when needed
5. **Unix Philosophy**: Composable with pipes, scripts, and other tools

## Architecture Overview

### File Structure
```
src/cli.ts          # Single CLI implementation file
├── Argument parsing (parseArgs)
├── Data transformation
├── Option building
└── SDK invocation (interactive mode)
```

### Execution Flow
```
1. Parse Arguments → 2. Handle Special Commands → 3. Build Options → 4. Launch Claude
```

## Core Components

### 1. Argument Parsing

Uses Node.js built-in `parseArgs`:

```typescript
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    // Simple flags
    prompt: { type: 'string', short: 'p' },
    help: { type: 'boolean', short: 'h' },
    
    // Multiple values
    data: { type: 'string', short: 'd', multiple: true },
    'docker-mount': { type: 'string', multiple: true },
    
    // Complex options
    'load-session': { type: 'string' },
    'docker-image': { type: 'string' },
  },
  allowPositionals: true
});
```

### 2. Data Processing

Transforms CLI arguments into SDK-compatible formats:

```typescript
// Parse key=value pairs
async function parseData(dataArgs: string[]): Promise<InterpolationData> {
  const data: InterpolationData = {};
  
  for (const arg of dataArgs) {
    const [key, ...valueParts] = arg.split('=');
    const value = valueParts.join('=');
    
    // Smart type detection
    try {
      data[key] = JSON.parse(value);  // Try JSON first
    } catch {
      // Handle special cases
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (/^-?\d+$/.test(value)) data[key] = parseInt(value);
      else data[key] = value;  // String fallback
    }
  }
  
  return data;
}
```

### 3. Option Building

Maps CLI flags to SDK options:

```typescript
const options: Partial<ClaudeOptions> = {};

// Direct mappings
if (values.system) options.system = values.system;
if (values.resume) options.resume = values.resume;
if (values.verbose) options.verbose = true;

// Complex mappings
if (values.tools) {
  // Handle both comma and space separated
  options.tools = values.tools.includes(',') 
    ? values.tools.split(',').map(t => t.trim())
    : values.tools.split(/\s+/).filter(t => t);
}

// Conditional logic
if (values.docker || values['docker-image']) {
  options.docker = values['docker-image'] 
    ? { image: values['docker-image'], mounts: values['docker-mount'] || [] }
    : true;  // Auto-detect mode
}
```

### 4. Command Routing

Special commands are handled before main execution:

```typescript
// Early exit commands
if (values['list-sessions']) {
  const sessions = await session.list();
  // Display sessions...
  process.exit(0);
}

// Session mode routing
if (values.session || values['load-session']) {
  const s = values['load-session'] 
    ? await session.load(values['load-session'])
    : session({ name: values.session });
    
  await s.interactive(promptFileOrText, options);
  process.exit(0);
}

// Default: launch interactive mode
await interactive(promptFileOrText, options);
```

## Current Features

### 1. Prompt Handling
- **File prompts**: `channelcoder prompts/analyze.md`
- **Inline prompts**: `channelcoder -p "Analyze this"`
- **Stdin data**: `echo '{"data": "value"}' | channelcoder prompt.md --data-stdin`

### 2. Data Interpolation
- **CLI data**: `-d key=value -d complex='{"nested": true}'`
- **Multiple formats**: Strings, numbers, booleans, JSON
- **Template support**: Variables available in prompts

### 3. Tool Configuration
- **Allowed tools**: `-t "Read Write" or --tools "Bash(git:*)"`
- **Disallowed tools**: `--disallowed-tools "Bash(rm:*)"`
- **MCP config**: `--mcp-config servers.json`

### 4. Session Management
- **New session**: `--session my-feature`
- **Load session**: `--load-session my-feature`
- **List sessions**: `--list-sessions`
- **Resume by ID**: `-r SESSION_ID` or `--resume SESSION_ID`
- **Continue latest**: `-c` or `--continue`

### 5. Docker Integration
- **Auto mode**: `--docker` (detects Dockerfile)
- **Specific image**: `--docker-image claude-sandbox`
- **Volume mounts**: `--docker-mount ./data:/data:ro`
- **Environment**: `--docker-env NODE_ENV=production`

### 6. System Prompts
- **System prompt**: `-s "Be concise"` or `-s prompts/expert.md`
- **Append system**: `--append-system "Always explain"`

### 7. Execution Control
- **Max turns**: `--max-turns 10`
- **Verbose mode**: `-v` or `--verbose`

## Upcoming: Worktree Integration

### Design Goals
- Maintain single-file simplicity
- Follow existing patterns
- Composable with all features
- Zero framework dependencies

### Proposed CLI Options

```typescript
// Add to parseArgs options
worktree: { type: 'string', short: 'w' },
'worktree-base': { type: 'string' },
'worktree-keep': { type: 'boolean' },
'list-worktrees': { type: 'boolean' },
'remove-worktree': { type: 'string' },
'cleanup-worktrees': { type: 'boolean' },
```

### Integration Pattern

Following the existing pattern:

```typescript
// 1. Handle worktree management commands (like list-sessions)
if (values['list-worktrees']) {
  const { worktreeUtils } = await import('./worktree/index.js');
  const worktrees = await worktreeUtils.list();
  
  console.log('Git worktrees:');
  for (const wt of worktrees) {
    console.log(`  ${wt.branch} - ${wt.path}`);
  }
  process.exit(0);
}

if (values['remove-worktree']) {
  const { worktreeUtils } = await import('./worktree/index.js');
  await worktreeUtils.remove(values['remove-worktree']);
  console.log(`Removed worktree: ${values['remove-worktree']}`);
  process.exit(0);
}

// 2. Build worktree options (like docker options)
if (values.worktree) {
  options.worktree = {
    branch: values.worktree,
    base: values['worktree-base'],
    cleanup: !values['worktree-keep']
  };
}
```

### Usage Examples

```bash
# Basic worktree usage
channelcoder "Implement feature" -w feature/auth

# With configuration
channelcoder "New API" --worktree feature/api --worktree-base develop --worktree-keep

# Management commands
channelcoder --list-worktrees
channelcoder --remove-worktree feature/old

# Composed with other features
channelcoder prompt.md -w feature/test --session test-session --docker
```

## Error Handling

The CLI provides user-friendly error messages:

```typescript
catch (error) {
  if (error.message.includes('ENOENT')) {
    console.error('❌ Error: File not found');
    console.error('💡 Make sure the file exists or use -p for inline prompts');
  } else if (error.message.includes('Input validation failed')) {
    console.error(`❌ ${error.message}`);
    console.error('💡 Check that all required fields are provided with -d');
  } else if (error.message.includes('Failed to launch Claude')) {
    console.error('❌ Error: Failed to launch Claude CLI');
    console.error('💡 Make sure Claude CLI is installed: npm install -g @anthropic-ai/claude-code');
  }
  // ... more specific error handling
}
```

## Help System

Comprehensive help text with examples:

```typescript
function showHelp() {
  console.log(`
ChannelCoder - Channel your prompts to Claude Code

Usage:
  channelcoder <prompt-file> [options]
  channelcoder -p "inline prompt" [options]
  
Options:
  -p, --prompt <text>      Use inline prompt instead of file
  -d, --data <key=value>   Data for interpolation (repeatable)
  // ... all options with descriptions
  
Examples:
  # Execute prompt file with data
  channelcoder prompts/analyze.md -d taskId=FEAT-123
  // ... practical examples
  `);
}
```

## Framework Migration: Adopting Stricli

### Current Limitations

As the CLI grows, several limitations have become apparent:

1. **Help Organization**: 20+ options in a flat list is becoming unwieldy
2. **No True Subcommands**: Using flags like `--list-sessions` instead of proper subcommands
3. **No Interactive Mode**: Cannot build wizards or guided experiences
4. **Type Safety**: String-based option parsing with manual type conversion
5. **Grouped Options**: No way to logically group related options in help

### Why Stricli?

After evaluating options (Commander.js, Yargs, Oclif), we've chosen **Stricli** for the following reasons:

1. **TypeScript-First**: Built specifically for TypeScript projects
   - Full type safety at compile time
   - No separate type definitions needed
   - Autocomplete for CLI development

2. **Modern Architecture**: Functional, composable command definitions
   ```typescript
   const worktreeCommand = buildCommand({
     parameters: {
       flags: {
         branch: flag({ kind: "string", alias: "w" }),
         keep: flag({ kind: "boolean" })
       }
     },
     async run({ flags }) {
       // flags.branch is typed as string | undefined
       // flags.keep is typed as boolean
     }
   });
   ```

3. **Excellent Help Generation**: Automatically generates well-organized help from type definitions

4. **Composable Commands**: Natural support for subcommands
   ```bash
   channelcoder worktree list         # Proper subcommands
   channelcoder session load my-session
   channelcoder config init           # Interactive wizard
   ```

5. **Interactive Support**: Works seamlessly with prompt libraries for wizards

6. **Small & Fast**: Minimal runtime overhead, tree-shakeable

### Migration Strategy

#### Phase 1: Add Stricli While Maintaining Compatibility
- Keep all current flags working exactly as they are
- Add proper subcommands alongside existing flags
- Better help organization with grouped options

#### Phase 2: Enhanced Features
- Add interactive configuration wizard
- Implement guided setup for complex features
- Add prompts for missing required options

#### Phase 3: Gradual Deprecation
- Mark old-style flags as deprecated in help
- Guide users to new subcommand structure
- Remove after sufficient transition period

### Proposed Command Structure

```bash
# Main execution (unchanged)
channelcoder prompts/analyze.md -d key=value --docker

# New subcommand structure
channelcoder run prompts/analyze.md        # Explicit run command
channelcoder session list                   # Replaces --list-sessions
channelcoder session load my-session        # Replaces --load-session
channelcoder worktree list                  # Replaces --list-worktrees
channelcoder worktree remove feature/old    # Replaces --remove-worktree
channelcoder config init                    # New: interactive setup wizard
```

### Implementation Plan

1. **Install Stricli**: Add as a dependency
2. **Create Command Structure**:
   ```
   src/cli/
   ├── index.ts              # Stricli app definition
   ├── commands/
   │   ├── run.ts           # Main execution command
   │   ├── session/
   │   │   ├── list.ts
   │   │   ├── load.ts
   │   │   └── remove.ts
   │   ├── worktree/
   │   │   ├── list.ts
   │   │   ├── create.ts
   │   │   └── remove.ts
   │   └── config/
   │       └── init.ts      # Interactive wizard
   ├── flags/               # Shared flag definitions
   └── compat.ts           # Backward compatibility layer
   ```

3. **Maintain Backward Compatibility**: All existing commands continue to work

### Benefits for Users

1. **Better Help**: Organized by command and option groups
2. **Discoverability**: Clear subcommand structure
3. **Interactive Mode**: Guided setup for complex features
4. **Type Safety**: Better error messages for invalid options
5. **Future Features**: Foundation for more interactive capabilities

### Benefits for Development

1. **Type Safety**: Catch CLI errors at compile time
2. **Better Testing**: Each command is a separate, testable unit
3. **Maintainability**: Clear separation of concerns
4. **Documentation**: Auto-generated from type definitions
5. **Refactoring**: TypeScript ensures changes don't break CLI contract

## Design Decisions

### Why Migrate to a Framework Now?

1. **Growing Complexity**: CLI has outgrown the simple single-file approach
2. **User Experience**: Need better help organization and discoverability
3. **Future Features**: Interactive modes and wizards require framework support
4. **Type Safety**: Manual parsing is error-prone as options grow
5. **Maintenance**: Structured approach scales better

### Why Stricli Over Alternatives?

1. **vs Commander.js**: Better TypeScript support, more modern API
2. **vs Yargs**: Cleaner API, better type inference
3. **vs Oclif**: Lighter weight, simpler for our needs
4. **vs No Framework**: Current approach doesn't scale well

### Pattern Consistency

All features follow the same pattern:
1. Parse options in `parseArgs`
2. Handle special commands early
3. Transform data as needed
4. Build options object
5. Pass to SDK function

This makes adding new features straightforward.

## Testing Approach

### Unit Testing
- Argument parsing logic
- Data transformation functions
- Option building

### Integration Testing
- Full command execution
- Error scenarios
- Output formatting

### Manual Testing
```bash
# Test various flag combinations
bun run cli --help
bun run cli -p "Test" -d key=value -v
bun run cli prompts/test.md --docker --session test
```

## Future Extensibility

The architecture supports future additions without major changes:

### Potential Features
- **Output formats**: `--output yaml`
- **Config files**: `--config .channelcoder.yml`
- **Profiles**: `--profile development`
- **Batch operations**: `--batch prompts/*.md`

### Adding Features

New features follow the established pattern:
1. Add option to `parseArgs`
2. Handle special commands if needed
3. Map to SDK options
4. Update help text

Example for a new feature:
```typescript
// 1. Add to parseArgs
'output-format': { type: 'string', short: 'o' },

// 2. Map to options
if (values['output-format']) {
  options.outputFormat = values['output-format'];
}

// 3. Update help
console.log('  -o, --output-format <fmt>  Output format (json, yaml, text)');
```

## Performance Considerations

### Startup Time
- Minimal imports until needed
- Lazy load heavy modules (like `session`)
- Quick path for help/version

### Memory Usage
- Stream large outputs
- Don't buffer unnecessarily
- Let SDK handle heavy lifting

## Conclusion

The ChannelCoder CLI maintains elegant simplicity through its single-file, framework-free design. It provides powerful features while staying maintainable and easy to extend. The upcoming worktree integration will follow these same patterns, ensuring consistency and simplicity.

The key to its success is following established patterns and resisting the urge to over-engineer. Each feature maps cleanly from CLI flags to SDK options, making the codebase predictable and maintainable.