# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Session Management**: Built-in conversation continuity
  - `session()` function creates session-aware versions of all functions
  - Automatic session ID tracking and chaining
  - Save/load sessions for long-running conversations
  - File-based storage in `~/.channelcoder/sessions/`
  - Session-required prompts via frontmatter
  - CLI flags: `--session`, `--load-session`, `--list-sessions`
- **Session API**:
  - `session.load(name)` - Load existing session
  - `session.list()` - List all saved sessions
  - Session methods: `id()`, `messages()`, `save()`, `clear()`
- **Template Integration**: Session data available in templates
  - Access via `{session.lastMessage}` and other session properties

## [2.0.0] - 2025-01-26

### Added
- **Function-based SDK**: Simple functions that mirror Claude CLI mental model
  - `claude(prompt, options)` - Main function with automatic file detection
  - `stream(prompt, options)` - Streaming responses
  - `interactive(prompt, options)` - Interactive terminal mode
  - `run(prompt, options)` - Explicit run mode
- **Interactive CLI**: Run Claude directly in your terminal with template processing
- **Template Variables**: Support for `{var}` and `${var}` syntax with defaults
- **File-based Prompts**: Load prompts from Markdown files with YAML frontmatter
- **Schema Validation**: Built-in Zod validation for inputs and outputs
- **Streaming Support**: Real-time streaming for long responses
- **Dry-run Mode**: Test commands without executing (`dryRun: true` option)
- **Template Literal Support**: Use `` await claude`Hello ${name}` ``

### Features
- **Automatic File Detection**: Detects files by `.md` extension or path patterns
- **Options-based Configuration**: All settings through a single options object
- **Session Management**: Resume and continue conversations
- **Tool Restrictions**: Fine-grained control over allowed tools
- **Multiple Execution Modes**: Run, stream, or interactive based on needs
