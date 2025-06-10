# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2025-06-10

### Added
- **Worktree Nesting Prevention**: Worktrees are now automatically created as siblings rather than nested children, preventing git repository corruption
- **Multi-Repository Support**: Added `cwd` parameter throughout SDK functions to enable working with multiple repositories from a single script
- **Enhanced Git Utilities**: New utility functions `isInWorktree()` and `findMainRepository()` for better repository detection and management

### Changed
- **WorktreeManager Behavior**: Worktree creation now uses main repository root detection for consistent placement
- **API Breaking Change**: `worktreeUtils.current()` now returns main repository information instead of null when called from the main repository, matching git's native behavior

### Fixed
- **Repository Detection**: Improved detection of main repository root when working within existing worktrees

## [2.8.4] - 2025-01-16

### Fixed
- **Worktree Integration**: Interactive and detached modes now properly support worktree execution with correct working directory setup

## [2.8.3] - 2025-06-10

### Fixed
- **Worktree Execution**: Fixed worktree execution functionality that was broken in previous versions

## [2.8.2] - 2025-06-09

### Fixed
- **Type Definitions**: Added missing 'stream-json' option to outputFormat type in ClaudeOptions interface

### Documentation
- **Session Management**: Added comprehensive pluggable storage documentation with examples
- **File-based Prompts**: Enhanced documentation with detailed usage patterns and best practices
- **Template System**: Corrected documentation to accurately reflect actual implementation behavior

## [2.8.1] - 2025-01-08

### Fixed
- **Mode Option Handling**: Fixed issue where mode option was not properly passed through to CCOptions, ensuring correct behavior for interactive and stream modes
- **Output Format**: Improved output format handling for stream mode to ensure proper stream-json format

## [2.8.0] - 2025-06-08

### Added
- **Comprehensive Documentation**: Complete documentation suite including guides for Docker mode, session management, stream parser, and worktree mode with reference materials
- **TypeScript Type Exports**: Enhanced SDK with additional exported types including LaunchOptions, RunOptions, StreamOptions, PromptConfig, DockerOptions, ResolvedDockerConfig, and ValidationResult for better TypeScript development experience

## [2.7.1] - 2025-01-28

### Fixed
- **CLI Commands**: Fixed `run` and `stream` commands not properly outputting content to users
- **Stream Parsing**: Corrected inverted logic in stream command parsing - now outputs content by default and raw JSON only when explicitly requested with `--parse` flag

## [2.7.0] - 2025-01-09

### Added
- **CLI Subcommands**: Restructured CLI with proper subcommands mapping to SDK functions
- **Interactive Command**: New dedicated interactive command for enhanced user experience
- **Stream Command**: New stream command for real-time output handling

### Changed
- **CLI Architecture**: Improved command structure and organization for better usability
- **Command Mapping**: Enhanced mapping between CLI commands and SDK functions
- **Flag Handling**: Improved flag processing and organization

## [2.6.1] - 2025-06-06

### Fixed
- **CLI Initialization**: Fixed broken release where CLI couldn't properly read package.json for version and description information, causing initialization failures

## [2.6.0] - 2025-06-06

### Added
- **Worktree Support**: Complete worktree management system with create, list, remove, and cleanup commands for isolated development environments
- **Enhanced CLI Architecture**: Migrated CLI to Stricli framework providing better command structure and type safety
- **Worktree SDK**: New SDK module for programmatic worktree management with comprehensive API
- **Session Management Commands**: New CLI commands for listing, loading, and removing development sessions
- **Worktree Usage Examples**: Added example code demonstrating worktree features and usage patterns

### Changed
- **CLI Structure**: Refactored CLI from monolithic structure to modular command-based architecture
- **Process Management**: Enhanced subprocess handling with better error reporting and stream management
- **Command Parsing**: Improved command line argument parsing and flag handling through Stricli integration

## [2.5.0] - 2025-06-05

### Added
- **Docker OAuth Authentication**: Run Claude Code in isolated Docker containers with pre-configured OAuth authentication, enabling secure multi-agent workflows
- **Automatic Security Defaults**: When using Docker mode, dangerous permissions are automatically skipped by default since the container provides network isolation
- **Firewall Protection**: Built-in firewall security enabled by default in Docker mode to prevent unauthorized network access
- **Easy Setup Scripts**: New `docker/setup-auth.sh` script for simple Docker authentication workflow setup
- **Persistent Auth Tokens**: Support for baking authentication tokens directly into Docker images for streamlined deployments

## [2.4.1] - 2025-06-02

### Fixed
- **Session Loading**: Fixed error when using `--load-session` without providing a prompt file. Users can now resume existing sessions without specifying new input, enabling workflows like `channelcoder --load-session <name>` to continue conversations seamlessly.

## [2.4.0] - 2025-01-06

### Added
- **Docker Mode**: Run Claude in isolated Docker containers for enhanced security and environment control
  - Use `--docker` flag with CLI or `docker: true` option in SDK
  - Automatic container management with volume mounting
  - Supports all standard Claude features in containerized environment
- **Docker SDK Integration**: New `docker()` function for programmatic Docker mode usage
  - Example: `await docker({ prompt: "Hello", vars: { name: "World" } })`
  - Full support for streaming, interactive mode, and session management
  - Compatible with all existing SDK options

### Changed
- **Enhanced CLI Options**: Added Docker-specific flags for container control
  - `--docker`: Enable Docker mode
  - `--docker-image`: Specify custom Claude Docker image
  - Improved help documentation for Docker features

### Fixed
- **Linting Issues**: Resolved TypeScript and Biome linting warnings for cleaner codebase
- **Session Management**: Fixed dry-run mode compatibility with Docker sessions

## [2.3.1] - 2025-05-31

### Fixed
- **CLI Resume Flag**: The `-r` (resume) flag now properly processes sessions instead of showing help text

## [2.3.0] - 2025-01-30

### Added
- **Stream Parser SDK**: Parse and process Claude's JSONL log files with real-time streaming support
- **Task Monitoring**: Monitor task progress and status with the new `TaskMonitor` class
- **Log File Parsing**: Read and parse both active and completed Claude session logs
- **TUI Example**: Interactive terminal UI for monitoring Claude tasks in real-time
- **Detached Session Support**: Parse logs from detached Claude sessions for background monitoring

### Changed
- **Internal Architecture**: Refactored process handling to use the new Stream Parser SDK internally

## [2.2.0] - 2025-01-30

### Added
- **Detached Streaming Mode**: Run long-running Claude sessions in the background while monitoring their progress in real-time
- **Real-time Session Monitoring**: Access session state, messages, and outputs while a session is running
- **Enhanced Session API**: New methods for checking session status, retrieving partial results, and managing detached sessions

### Fixed
- **Session Detached Tracking**: Improved reliability of detached session state tracking and recovery

## [Unreleased]

### Added
- **Detached Streaming**: Enhanced detached mode with real-time streaming support via `stream: true` option
- **Session Auto-Save**: Real-time session file updates during streaming conversations with `autoSave: true`
- **Real-time Monitoring**: Ability to monitor both Claude output and session state in real-time for background processes
- **Unix Composability**: Full support for monitoring detached processes with standard Unix tools (`tail -f`, `jq`, `watch`)

### Enhanced
- **Detached Mode**: Now supports `--output-format stream-json` for real-time log file updates
- **Session Management**: Session files are updated incrementally during streaming for better monitoring
- **Error Handling**: Better validation and error messages for detached streaming configuration

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
