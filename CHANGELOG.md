# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2025-01-29

### Fixed
- **Interactive Mode**: Resolved "Raw mode is not supported" error when using interactive mode with the latest Claude CLI. The fix changes from shell piping to proper TTY handling, ensuring compatibility with Claude's new Ink-based interactive UI.

## [2.1.0] - 2025-01-28

### Added
- **Session Management**: Save and continue conversations across multiple CLI invocations, maintaining context and history for complex multi-step workflows
- **Detached Mode**: Run Claude operations in the background with new `detached: true` option, enabling non-blocking execution
- **Session Storage API**: New `SessionStorage` class for managing conversation persistence with automatic cleanup
- **Enhanced CLI**: Added `--session` flag to enable session continuity from the command line
- **New Examples**: Added comprehensive session management examples including code review, debugging, and iterative development workflows

### Changed
- **Improved Error Handling**: Better error messages and recovery options when Claude operations fail
- **Enhanced Process Management**: More robust subprocess handling with improved stream processing

### Fixed
- **Type Issues**: Resolved linting and type errors in session management implementation
- **Stream Processing**: Fixed edge cases in streaming output handling

## [2.1.0] - 2025-01-28

### Added
- **Session Management**: Save and continue conversations across multiple CLI invocations, maintaining context and history for complex multi-step workflows
- **Detached Mode**: Run Claude operations in the background with new `detached: true` option, enabling non-blocking execution
- **Session Storage API**: New `SessionStorage` class for managing conversation persistence with automatic cleanup
- **Enhanced CLI**: Added `--session` flag to enable session continuity from the command line
- **New Examples**: Added comprehensive session management examples including code review, debugging, and iterative development workflows

### Changed
- **Improved Error Handling**: Better error messages and recovery options when Claude operations fail
- **Enhanced Process Management**: More robust subprocess handling with improved stream processing

### Fixed
- **Type Issues**: Resolved linting and type errors in session management implementation
- **Stream Processing**: Fixed edge cases in streaming output handling

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
