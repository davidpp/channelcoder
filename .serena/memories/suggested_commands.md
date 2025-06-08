# Suggested Commands for Development

## System Commands (Darwin/macOS)
- `git` - Version control
- `ls` - List files (macOS version)
- `cd` - Change directory
- `grep` - Search files (prefer `rg`/ripgrep when available)
- `find` - Find files
- `cat` - View file contents
- `mkdir` - Create directories
- `rm` - Remove files (be careful)

## Build and Test
```bash
bun run build          # Compile TypeScript
bun run test           # Run all tests
bun run test:watch     # Watch mode for TDD
bun run test:compat    # Run Node.js compatibility tests
bun test path/to/test.ts  # Run specific test file
```

## Code Quality Commands (Run before committing!)
```bash
bun run check          # Smart check - only changed files
bun run check:full     # Full project check
bun run lint:fix       # Auto-fix linting issues
bun run format         # Format code with Biome
bun run typecheck      # Type checking only
```

## Development Commands
```bash
bun run dev            # Watch mode for development
bun run example:quick  # Test SDK examples
bun run cli:help       # Test CLI functionality
```

## Release Management
```bash
bun run release:precheck   # Verify release readiness
bun run release:analyze    # Analyze changes for release
bun run release:execute    # Execute release process
bun run release:publish    # Publish to npm
```

## Running Examples
```bash
bun run examples/basic-usage.ts
bun run examples/launch-modes.ts run
```