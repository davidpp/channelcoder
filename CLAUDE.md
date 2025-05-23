# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChannelCoder is a streamlined SDK and CLI wrapper for Claude Code that enhances prompt engineering capabilities through multi-place variable interpolation, schema validation, and file-based prompts.

## Development Commands

```bash
# Build and Test
bun run build          # Compile TypeScript
bun run test           # Run all tests
bun run test:watch     # Watch mode for TDD
bun run typecheck      # Type checking only

# Code Quality (ALWAYS run before committing)
bun run check          # Smart check - only changed files
bun run check:full     # Full project check
bun run lint:fix       # Auto-fix linting issues
bun run format         # Format code with Biome

# Development
bun run dev            # Watch mode for development
bun run example:quick  # Test SDK examples
bun run cli:help       # Test CLI functionality
```

## Architecture

### Core Classes and Their Responsibilities

1. **CC (cc.ts)** - Main SDK entry point
   - Handles file loading, template processing, and execution
   - Supports both streaming and non-streaming responses
   - Manages schema validation with Zod

2. **CCProcess (process.ts)** - Claude CLI integration
   - Spawns and manages Claude CLI subprocess
   - Handles streaming output and error parsing
   - Manages tool restrictions and command arguments

3. **PromptBuilder (prompt-builder.ts)** - Fluent API
   - Chainable methods for building complex prompts
   - Supports data, tools, and configuration

4. **PromptTemplate (template.ts)** - Variable interpolation
   - Multi-place variable substitution
   - Conditional expressions with JavaScript
   - Template validation

### Key Patterns

- Variable interpolation: `{varName}` or `{varName || 'default'}`
- Conditional prompts: `{#if condition}...{#endif}`
- Tool patterns: Use `Bash(git:*)` for specific command restrictions
- File-based prompts: Markdown files with YAML frontmatter

### Testing Approach

- Unit tests for each module in `test/` directory
- Integration tests for CLI functionality
- Use `bun test <filename>` to run specific test files
- Mock Claude CLI responses in tests to avoid API calls

### Important Conventions

1. **Error Handling**: Always use `CCResult<T>` type for operations that can fail
2. **Streaming**: Check `options.stream` before processing responses
3. **Tool Restrictions**: Validate tool patterns match Claude's expected format
4. **Template Processing**: Process templates before passing to Claude CLI
5. **Schema Validation**: Use Zod schemas for input/output validation when provided