# Code Style and Conventions

## General Principles
- **Node.js APIs only** - No Bun-specific APIs to maintain dual compatibility
- TypeScript with strict mode enabled
- ES2022 target and module system
- Type-safe error handling using `CCResult<T>` type

## Code Formatting
- Use Biome for both linting and formatting
- Run `bun run format` to auto-format code
- Configuration in biome.json

## Testing Conventions
- Tests use Bun's built-in test runner
- Test files in `test/` directory
- Mock Claude CLI responses to avoid API calls
- Key utilities: `spyOn()`, `mock()`, `mock.module()`

## Architecture Patterns
- **Main SDK functions**: `claude()`, `stream()`, `interactive()`, `run()`, `detached()`
- **Variable interpolation**: `{varName}` or `{varName || 'default'}`
- **Conditional prompts**: `{#if condition}...{#endif}`
- **Tool patterns**: `Bash(git:*)` for specific command restrictions

## Important Conventions
1. Always use `CCResult<T>` for operations that can fail
2. Check `options.stream` before processing responses
3. Validate tool patterns match Claude's expected format
4. Process templates before passing to Claude CLI
5. Use Zod schemas for input/output validation when provided
6. InterpolationValue type supports nested objects and arrays
7. All Claude CLI args are passed through, frontmatter maps to specific CLI flags