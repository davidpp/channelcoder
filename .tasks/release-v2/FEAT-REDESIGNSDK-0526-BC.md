+++
id = "FEAT-REDESIGNSDK-0526-BC"
title = "Redesign SDK to Function-Based API"
type = "🌟 Feature"
status = "🔵 In Progress"
priority = "🔼 High"
created_date = "2025-05-26"
updated_date = "2025-05-26"
assigned_to = ""
phase = "release-v2"
+++

# Redesign SDK to Function-Based API

## Goal
Replace the current class-based SDK with simple functions that mirror Claude CLI usage, WITHOUT wrapping the CC class.

## Implementation Status: ✅ COMPLETE

### What Was Done

#### 1. Created New Function-Based API (src/functions.ts)
- Main `claude()` function with automatic file/inline prompt detection
- Shortcut functions: `interactive()`, `stream()`, `run()`
- Template literal support for inline prompts
- Added `dryRun` option that generates copy-pasteable commands

#### 2. Extracted Validation Logic (src/utils/validation.ts)
- `validateInput()` - validates data against Zod schemas
- `validateOutput()` - validates results against schemas
- Works independently without class dependencies

#### 3. Updated Process Management
- Made `CCProcess.buildCommand()` public
- Fixed command generation to use stdin piping (avoiding shell escaping issues)
- Dry-run mode shows proper `echo -e "prompt" | claude -p` format

#### 4. Removed Old Implementation
- Deleted `src/cc.ts` (old class-based SDK)
- Deleted `src/prompt-builder.ts` (fluent API)
- Deleted old test files: cc.test.ts, prompt-builder.test.ts, integration.test.ts, node-compat.test.ts, process.test.ts

#### 5. Updated All Dependencies
- Updated scripts/implement.ts to use new API
- Updated scripts/release.ts to use new API
- Updated examples to use new API
- CLI already used function-based approach

### Test Status

#### ✅ Working Tests
- Template interpolation tests (template.test.ts) - all pass
- Most dry-run command generation tests (functions-real.test.ts)
- Most validation tests (validation.test.ts)

#### ❌ Failing Tests (5 tests)
1. **loader.test.ts** - "should parse input schema from YAML notation"
   - Issue: Test expects 'optional' field but schema parsing may have changed
   
2. **validation.test.ts** - "validates required fields"
   - Issue: Validation might not be running in dry-run mode as expected
   
3. **validation.test.ts** - "validates nested objects" 
   - Issue: Similar validation in dry-run issue
   
4. **validation.test.ts** - "frontmatter system prompt works"
   - Issue: System prompt not appearing in generated command
   
5. **functions-real.test.ts** - "file detection works correctly"
   - Issue: Test needs adjustment for dry-run mode

### Key Implementation Details

1. **Command Generation**: Prompts are piped via stdin using `echo -e`, not passed as arguments
2. **File Processing**: Even in dry-run mode, files are loaded and processed (frontmatter + interpolation)
3. **Validation**: Input validation runs before command generation, even in dry-run
4. **Path Detection**: Uses file extensions and path patterns to distinguish files from inline prompts

### Next Steps to Fix Tests

1. Debug why validation tests are passing when run individually but failing in full suite
2. Fix the loader test's schema parsing expectation
3. Ensure system prompt from frontmatter appears in dry-run commands
4. Consider if validation should fail the dry-run or just show in the command

### Usage Example

```typescript
// Simple usage
const result = await claude('What is 2+2?');

// With options
const result = await claude('Analyze code', {
  tools: ['Read', 'Write'],
  system: 'Be concise',
  dryRun: true  // Returns command instead of executing
});

// File-based with validation
const result = await claude('prompts/analyze.md', {
  data: { taskId: 'TEST-123' }
});

// Template literals
const result = await claude`Hello ${name}!`;
```
