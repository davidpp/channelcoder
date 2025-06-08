# ChannelCoder Project Structure

## Core Modules

### Main Entry Points
- `src/index.ts` - Main package exports
- `src/functions.ts` - Core SDK functions (claude, stream, interactive, run, detached)
- `src/cli.ts` - CLI entry point

### Core Functionality
- `src/process.ts` - Claude CLI subprocess management and integration
- `src/template.ts` - Variable interpolation and template processing
- `src/loader.ts` - File loading and frontmatter parsing
- `src/validation.ts` - Zod schema validation utilities
- `src/types.ts` - Shared TypeScript types and interfaces

### Feature Modules
- `src/session.ts` & `src/session-storage.ts` - Session management
- `src/docker.ts` - Docker mode implementation
- `src/worktree/` - Git worktree functionality
- `src/stream-parser/` - Stream parsing SDK for logs

### CLI Structure
- `src/cli/` - CLI implementation using a command pattern
- `src/cli/commands/` - Individual command implementations
  - `run.ts` - Run command
  - `stream.ts` - Stream command  
  - `interactive.ts` - Interactive command
  - `session/` - Session subcommands
  - `worktree/` - Worktree subcommands

## Architecture Documents
The `/docs` directory contains up-to-date architecture documentation:
- `cli-architecture.md` - CLI design and structure
- `session-sdk-architecture.md` - Session management design
- `docker-sdk-architecture.md` - Docker mode implementation
- `worktree-sdk-architecture.md` - Git worktree integration

## Key Patterns
- Commands follow a consistent pattern with context object
- All operations return `CCResult<T>` for error handling
- Frontmatter in .md files maps to CLI options
- Template processing happens before Claude CLI execution