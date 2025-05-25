+++
id = "FEAT-ADDDISALLOWEDTOOLS-0525-KP"
title = "Add disallowedTools and mcpConfig Support"
type = "🌟 Feature"
status = "🟡 To Do"
priority = "🔼 High"
created_date = "2025-05-25"
updated_date = "2025-05-25"
assigned_to = "dev-team"
phase = "release-v2"
tags = [ "sdk", "cli-compatibility", "high-priority" ]
+++

# Add disallowedTools and mcpConfig Support

## Problem Statement

Based on analysis of Anthropic's official claude-code-base-action, we're missing two important features that the Claude CLI supports:

1. **disallowedTools** - Ability to explicitly block certain tools while allowing others
2. **mcpConfig** - Model Context Protocol configuration for custom tool servers

These are simple pass-through features to the CLI but provide significant value for enterprise users and advanced use cases.

## User Stories

1. **As a security-conscious developer**, I need to prevent Claude from using certain tools (like Bash) while still allowing file operations, ensuring safe code analysis in CI/CD pipelines.

2. **As an enterprise developer**, I need to configure custom MCP servers to give Claude access to internal APIs and proprietary tools specific to my organization.

3. **As a developer building restricted environments**, I need fine-grained control over what tools Claude can and cannot use, beyond just an allowlist.

## Solution Overview

Add support for `disallowedTools` and `mcpConfig` options that map directly to Claude CLI flags. These will be simple pass-through implementations with minimal abstraction.

## Technical Design

### 1. Update CCOptions Interface

```typescript
// src/types.ts
export interface CCOptions {
  // Existing options...
  
  /**
   * Tools that Claude is explicitly forbidden from using.
   * Takes precedence over allowedTools if both are specified.
   * @example ['Bash', 'Write'] - Prevents shell commands and file writes
   */
  disallowedTools?: string[];
  
  /**
   * MCP (Model Context Protocol) configuration for custom tool servers.
   * Can be either a path to a JSON config file or an inline configuration object.
   * @example '/path/to/mcp-config.json'
   * @example { mcpServers: { 'my-server': { command: 'node', args: ['./server.js'] } } }
   */
  mcpConfig?: string | MCPConfig;
}

// Optional: Type-safe MCP config
export interface MCPConfig {
  mcpServers: {
    [serverName: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}
```

### 2. Update Command Building

```typescript
// src/process.ts - in buildCommand() method
private buildCommand(options: CCProcessOptions): string[] {
  const args: string[] = [];
  
  // Existing code...
  
  // Add disallowed tools
  if (options.disallowedTools && options.disallowedTools.length > 0) {
    args.push('--disallowedTools', options.disallowedTools.join(','));
  }
  
  // Add MCP config
  if (options.mcpConfig) {
    if (typeof options.mcpConfig === 'string') {
      // Path to config file
      args.push('--mcp-config', options.mcpConfig);
    } else {
      // Inline config object - write to temp file or pass as JSON
      // Claude CLI expects a file path, so we need to handle this
      const configPath = this.writeTempMcpConfig(options.mcpConfig);
      args.push('--mcp-config', configPath);
    }
  }
  
  return args;
}

// Helper method for inline MCP configs
private writeTempMcpConfig(config: MCPConfig): string {
  const tempPath = path.join(os.tmpdir(), `cc-mcp-${Date.now()}.json`);
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  // TODO: Clean up temp file after process completes
  return tempPath;
}
```

### 3. Update Fluent API

```typescript
// src/prompt-builder.ts
export class PromptBuilder {
  // Existing methods...
  
  /**
   * Specify tools that Claude cannot use
   */
  withoutTools(tools: string[]): this {
    this.options.disallowedTools = tools;
    return this;
  }
  
  /**
   * Configure MCP servers for custom tools
   */
  withMcpConfig(config: string | MCPConfig): this {
    this.options.mcpConfig = config;
    return this;
  }
}
```

### 4. Usage Examples

```typescript
// Example 1: Disallow dangerous tools
const result = await cc.run("Analyze this codebase", {
  allowedTools: ['Read', 'Grep', 'Glob'],
  disallowedTools: ['Bash', 'Write'] // Extra safety
});

// Example 2: With fluent API
const result = await cc.prompt`Review this PR`
  .withTools(['Read', 'Grep'])
  .withoutTools(['Bash']) // Explicitly forbid shell access
  .run();

// Example 3: MCP config from file
const result = await cc.run("Use custom tools", {
  mcpConfig: './mcp-config.json'
});

// Example 4: Inline MCP config
const result = await cc.run("Query internal API", {
  mcpConfig: {
    mcpServers: {
      'internal-api': {
        command: 'node',
        args: ['./mcp-servers/api-bridge.js'],
        env: {
          API_KEY: process.env.INTERNAL_API_KEY
        }
      }
    }
  }
});

// Example 5: Combined with file-based prompt
const result = await cc.fromFile('analyze.md', {
  data: { codebase: './src' },
  disallowedTools: ['Write'],
  mcpConfig: './tools/mcp-config.json'
});
```

## Implementation Steps

1. **Update type definitions** (`src/types.ts`)
   - Add `disallowedTools` and `mcpConfig` to CCOptions
   - Add MCPConfig interface for type safety

2. **Update command building** (`src/process.ts`)
   - Handle disallowedTools flag formatting
   - Handle both string and object mcpConfig
   - Implement temp file creation for inline configs

3. **Update fluent API** (`src/prompt-builder.ts`)
   - Add `withoutTools()` method
   - Add `withMcpConfig()` method

4. **Add tests** (`test/process.test.ts`)
   - Test disallowedTools flag generation
   - Test mcpConfig with file path
   - Test mcpConfig with inline object
   - Test combination of allowed and disallowed tools

5. **Update documentation**
   - Add examples to README
   - Document tool precedence rules
   - Explain MCP configuration format

## Testing Checklist

- [ ] disallowedTools generates correct CLI flag
- [ ] Empty disallowedTools array doesn't add flag
- [ ] mcpConfig with file path passes through correctly
- [ ] mcpConfig with object creates temp file
- [ ] Temp files are cleaned up after execution
- [ ] Both options work with streaming
- [ ] Both options work with file-based prompts
- [ ] Fluent API methods work correctly

## Edge Cases to Handle

1. **Both allowed and disallowed tools specified**
   - Document that disallowed takes precedence
   - Let Claude CLI handle the logic

2. **Invalid MCP config**
   - Basic JSON validation before writing temp file
   - Let Claude CLI validate the actual config

3. **Temp file cleanup**
   - Ensure temp MCP configs are deleted after use
   - Handle process termination gracefully

## Success Criteria

1. Users can restrict specific tools while allowing others
2. Users can configure custom MCP servers easily
3. No breaking changes to existing API
4. Clear documentation with examples
5. Proper TypeScript types for MCP configuration

## Notes

- These are simple pass-through features - we don't need to validate tool names
- Claude CLI handles all the actual logic
- Focus on clean API and good developer experience
- Consider adding MCP config examples to the examples folder
