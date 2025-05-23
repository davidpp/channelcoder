# Changelog

All notable changes to this project will be documented in this file.



## [1.1.0] - 2025-01-23

### Fixed
- **Version Sync**: Corrected package.json version after 1.0.0 release

## [0.6.0] - 2024-12-19

### Added
- **Node.js Compatibility**: ChannelCoder now runs on both Node.js and Bun runtimes, expanding usage to more environments
- **Dual Runtime Support**: Users can now choose between Node.js or Bun based on their project requirements

## [1.0.0] - 2024-12-28

### Added
- **ChannelCoder SDK**: Complete TypeScript SDK for Claude Code integration with fluent API and streaming support
- **CLI Wrapper**: Enhanced command-line interface with improved prompt engineering capabilities  
- **Variable Interpolation**: Multi-place variable substitution in prompts with conditional expressions
- **Schema Validation**: Zod-based input/output validation for type-safe prompt responses
- **File-based Prompts**: Support for Markdown prompt templates with YAML frontmatter
- **Prompt Builder**: Chainable API for building complex prompts with data, tools, and configuration
- **Tool Restrictions**: Fine-grained control over Claude CLI tool access patterns
- **Examples**: Comprehensive example library demonstrating SDK and CLI usage patterns
- **Test Suite**: Complete test coverage using Bun's test runner with mocking support
- **Release Automation**: Automated release workflow with changelog generation and version management