# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - TBD

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

## [1.1.1] - 2025-01-24

### Added
- **Template Syntax**: New `{var}` interpolation syntax alongside existing `${var}` for better fish shell compatibility

### Fixed
- **CLI Installation**: Resolved critical npm global installation failure due to incorrect module detection
- **Command Conflict**: Removed `cc` command alias that conflicted with system C compiler on macOS
- **Module Detection**: Fixed CLI failing to execute when installed globally via npm

## [1.1.0] - 2025-01-23

### Fixed
- **Version Sync**: Corrected package.json version after 1.0.0 release

## [0.6.0] - 2024-12-19

### Added
- **Node.js Compatibility**: ChannelCoder now runs on both Node.js and Bun runtimes, expanding usage to more environments
- **Dual Runtime Support**: Users can now choose between Node.js or Bun based on their project requirements

- **Test Suite**: Complete test coverage using Bun's test runner with mocking support
- **Release Automation**: Automated release workflow with changelog generation and version management