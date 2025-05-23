# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChannelCoder is a streamlined SDK and CLI wrapper for Claude Code that enhances prompt engineering capabilities through multi-place variable interpolation, schema validation, and file-based prompts.

## Important: Node.js and Bun Compatibility

**This project MUST maintain compatibility with both Node.js and Bun runtimes.** 

When making changes:
- Use only Node.js APIs (no Bun-specific APIs like `Bun.spawn`)
- Test changes in both environments using `bun run test:compat`
- Ensure the build produces both CJS and ESM formats
- Keep the CLI shebang as `#!/usr/bin/env node`

The project uses Node.js APIs throughout because Bun aims to be Node.js compatible, making this the simplest approach for dual compatibility.

## Development Commands

```bash
# Build and Test
bun run build          # Compile TypeScript
bun run test           # Run all tests with Bun's built-in test runner
bun run test:watch     # Watch mode for TDD
bun run test:compat    # Run Node.js compatibility tests
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

# Release Management
bun run release:precheck   # Verify release readiness
bun run release:analyze    # Analyze changes for release
bun run release:execute    # Execute release process
bun run release:publish    # Publish to npm

# Run specific test file
bun test path/to/test.ts
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

5. **Loader (loader.ts)** - File handling
   - Loads and parses Markdown files with YAML frontmatter
   - Validates frontmatter against Zod schemas
   - Resolves file paths for system prompts

### Key Patterns

- Variable interpolation: `{varName}` or `{varName || 'default'}`
- Conditional prompts: `{#if condition}...{#endif}`
- Tool patterns: Use `Bash(git:*)` for specific command restrictions
- File-based prompts: Markdown files with YAML frontmatter

### Testing Approach

- Tests use Bun's built-in test runner (migrated from Vitest)
- Unit tests for each module in `test/` directory
- Integration tests for CLI functionality
- Use `bun test <filename>` to run specific test files
- Mock Claude CLI responses in tests to avoid API calls
- Key test utilities:
  - `spyOn(object, method)` for spying on methods
  - `mock(() => {})` for creating mock functions
  - `mock.module()` for mocking Node modules (limited support)

### Important Conventions

1. **Error Handling**: Always use `CCResult<T>` type for operations that can fail
2. **Streaming**: Check `options.stream` before processing responses
3. **Tool Restrictions**: Validate tool patterns match Claude's expected format
4. **Template Processing**: Process templates before passing to Claude CLI
5. **Schema Validation**: Use Zod schemas for input/output validation when provided
6. **Type Safety**: InterpolationValue type supports nested objects and arrays
7. **CLI Integration**: All Claude CLI args are passed through, frontmatter maps to specific CLI flags

### Release Process

The release workflow uses `scripts/release.ts` with CC's own prompting system:
1. `release:precheck` - Ensures clean git state and all checks pass
2. `release:analyze` - Uses Claude to analyze changes and suggest version
3. `release:execute` - Updates version, changelog, and creates git tag
4. `release:publish` - Publishes to npm registry

### Code Quality Tools

- **Biome**: Used for both linting and formatting (configured in biome.json)
- **TypeScript**: Strict mode enabled, check with `bun run typecheck`
- **Smart Check**: `scripts/code-check.ts` filters errors to changed files only
  - Use `--staged` for pre-commit checks
  - Use `--full` for complete project check
  - Use `--base=main` to check against specific branch