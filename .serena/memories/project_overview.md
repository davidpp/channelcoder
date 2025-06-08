# ChannelCoder Project Overview

## Purpose
ChannelCoder is a streamlined SDK and CLI wrapper for Claude Code that enhances prompt engineering capabilities through:
- Multi-place variable interpolation
- Schema validation with Zod
- File-based prompts with YAML frontmatter
- Multiple execution modes (run, stream, interactive, detached)
- Session management for conversation continuity
- Git worktree support for isolated development
- Docker mode for enhanced security

## Tech Stack
- **Runtime**: Node.js 18+ and Bun (dual compatibility required)
- **Language**: TypeScript with strict mode
- **Build**: tsup (produces both CJS and ESM formats)
- **Test Runner**: Bun's built-in test runner
- **Code Quality**: Biome (for linting and formatting)
- **Schema Validation**: Zod
- **Target**: ES2022

## Key Features
1. Simple function API mirroring Claude CLI's mental model
2. Variable interpolation in prompts
3. File-based prompts with frontmatter configuration
4. Streaming support for real-time responses
5. Session management for multi-turn conversations
6. Git worktree integration for parallel development
7. Docker mode for isolated execution
8. Stream parser SDK for log analysis