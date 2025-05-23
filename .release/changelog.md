## [0.1.0] - 2025-05-22

### Added
- **Schema Validation**: Zod schema validation for frontmatter in prompt templates, enabling type-safe prompt configurations
- **Bun Test Runner**: Migrated from Vitest to Bun's built-in test runner for faster testing and better integration

### Changed
- **Documentation**: Improved examples and documentation for better developer experience

### Fixed
- **Path Resolution**: Fixed critical path resolution issues in file-based-usage examples that prevented proper file loading
- **JSON Parsing**: Resolved JSON parsing errors in examples that caused runtime failures
- **Claude CLI Integration**: Fixed integration issues with Claude CLI for more reliable prompt execution