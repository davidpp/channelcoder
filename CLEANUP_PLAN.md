# ChannelCoder SDK Cleanup Plan

## Overview
Complete the SDK redesign by cleaning up all references to the old class-based API and ensuring all documentation, examples, and configuration files reflect the new function-based design.

## 1. Documentation Updates

### ✅ Already Updated
- `README.md` - Already shows new function-based API
- `docs/sdk-structure.md` - Fully updated with new API documentation
- All example code files - Already using new API

### ❌ Needs Updating

#### `examples/README.md` (Lines 170-181)
**Current:** Shows old API usage in "Creating Your Own Examples" section
```typescript
const result = await cc.fromFile('your-prompt.md', {
  param1: 'value',
  param2: true
});

const validated = cc.validate(result, YourSchema);
```

**Should be updated to:**
```typescript
const result = await claude('your-prompt.md', {
  data: {
    param1: 'value',
    param2: true
  }
});

// Validation is automatic if schema is in frontmatter
```

### ❌ Needs Updating

#### `CLAUDE.md` (Lines 56-68)
**Current:** References old CC class and PromptBuilder
```markdown
1. **CC (cc.ts)** - Main SDK entry point
   - Handles file loading, template processing, and execution
   - Supports both streaming and non-streaming responses
   - Manages schema validation with Zod

2. **CCProcess (process.ts)** - Claude CLI integration
   - Spawns and manages Claude CLI subprocess
   - Handles streaming output and error parsing
   - Manages tool restrictions and command arguments

3. **PromptBuilder (prompt-builder.ts)** - Fluent API
   - Chainable methods for building complex prompts
   - Supports data, tools, and configuration
```

**Should be updated to:**
- Remove CC and PromptBuilder sections
- Update to describe the new function-based architecture
- Add sections for:
  - `functions.ts` - Main SDK functions (claude, stream, interactive, run)
  - `process.ts` - Claude CLI integration (keep this)
  - `template.ts` - Template interpolation engine
  - `loader.ts` - File loading and frontmatter parsing
  - `validation.ts` - Input/output schema validation

## 2. Configuration File Updates

### `package.json`
**Line 26:** `"test:compat": "bun test test/node-compat.test.ts"`
- This test file was deleted in the redesign
- Either remove this script or update it to test actual compatibility

### `scripts/test-both.ts`
**Lines 40, 62:** References `test/node-compat.test.ts`
- This script tries to run the deleted compatibility test
- Either update to run actual tests or remove the script
- Also referenced by `"test:both": "bun scripts/test-both.ts"` in package.json

## 3. Dead Code Removal

### ✅ Already Removed
- `src/cc.ts` - Old CC class
- `src/prompt-builder.ts` - Old PromptBuilder class
- Old test files (cc.test.ts, prompt-builder.test.ts, etc.)

### ✅ Clean Exports
- `src/index.ts` only exports new function-based API
- No legacy exports remain

## 4. Type Definition Updates

### ✅ Already Clean
- All exported types are for the new API
- No references to old classes in type definitions

## 5. CHANGELOG Updates

### Needs Entry
Add entry for version 2.0.0 documenting the major API redesign:
- Breaking change: Removed class-based API
- New function-based API matching Claude CLI mental model
- Improved error handling and type safety
- Fixed system prompt and optional field bugs

## 6. Test Files Organization

### Current Status
- All tests updated to use new API
- Real test prompt files created in `test/prompts/`
- One failing test: nested object validation (documented limitation)

### Recommendation
- Keep the failing test with TODO comment as documentation of known limitation
- Consider creating a separate test file for "known limitations" if more arise
- Alternative: Skip the nested object test until proper support is added

## 7. Build and Distribution

### Verify
- Ensure build output only includes necessary files
- Check that CLI binary works with new implementation
- Verify both CJS and ESM builds work correctly

## 8. Final Checks

### Before Release
1. Run full test suite
2. Build and test CLI locally
3. Test examples manually
4. Update version to 2.0.0 (major breaking change)
5. Review all TODO comments in code
6. Ensure no console.log statements remain

## 9. Bugs Fixed During Redesign

### ✅ Fixed
1. **System Prompt Bug** - Frontmatter system prompts now appear in dry-run commands
2. **Optional Field Names** - Optional fields with `?` notation now have the `?` stripped from property names

### 📝 Documented Limitation
1. **Nested Object Validation** - Complex nested schemas not fully supported (see `test/BUGS.md`)

## Summary

The main work needed:
1. Update `CLAUDE.md` architecture section (remove CC/PromptBuilder references)
2. Update `examples/README.md` "Creating Your Own Examples" section
3. Fix or remove `test:compat` script in package.json
4. Fix or remove `scripts/test-both.ts` that references deleted test
5. Add CHANGELOG entry for v2.0.0 (major breaking change)
6. Update package.json version to 2.0.0
7. Final testing and publish

The codebase is otherwise clean with:
- ✅ No dead code files
- ✅ All example code files updated
- ✅ Main documentation updated
- ✅ Clean exports
- ✅ Type definitions correct
- ✅ Scripts using new API