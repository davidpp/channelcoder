+++
id = "CHORE-REMOVEOUTPUT-0525-3M"
title = "Remove Output Schema Validation Feature"
type = "🧹 Chore"
status = "🟡 To Do"
priority = "▶️ Medium"
created_date = "2025-05-25"
updated_date = "2025-05-25"
assigned_to = "dev-team"
phase = "release-v2"
tags = [ "breaking-change", "cleanup", "simplification" ]
+++

# Remove Output Schema Validation Feature

## Problem Statement

Output schema validation is misaligned with Claude Code's purpose as an agentic tool. Claude Code is designed for complex, conversational tasks with varied outputs (explanations, code, tool logs), not structured data extraction. The schema validation adds complexity without providing value that users couldn't easily implement themselves.

This feature creates false expectations about what Claude Code is designed to do and complicates the API unnecessarily.

## Rationale for Removal

1. **Misaligned with Claude Code's purpose** - It's an agentic tool, not a structured data API
2. **No direct support** - Claude Code doesn't have built-in schema support; we validate after the fact
3. **Minimal value add** - Users can easily do `schema.parse(result.data)` themselves
4. **API complexity** - Adds methods and types that complicate the SDK
5. **False expectations** - Suggests Claude Code is meant for structured extraction

## Scope of Removal

This task requires removing ALL references to output schema validation across the entire codebase:

### 1. Type Definitions (`src/types.ts`)
- Remove `outputSchema?: z.ZodType<any>` from `CCOptions`
- Remove `warnings?: string[]` from `CCResult` (only used for schema warnings)
- Remove any schema-related type imports

### 2. Core Class (`src/cc.ts`)
- Remove `validate()` static method
- Remove schema validation logic from `run()` method
- Remove schema validation logic from `fromFile()` method
- Remove any Zod imports if no longer needed
- Remove schema-related error handling

### 3. Process Class (`src/process.ts`)
- Remove any schema validation in `execute()` method
- Clean up result building to remove warnings field

### 4. Prompt Builder (`src/prompt-builder.ts`)
- Remove `withOutputSchema()` method
- Remove schema field from builder options

### 5. Loader (`src/loader.ts`)
- Remove `output` field from frontmatter schema
- Remove output schema parsing from file loading
- Update frontmatter type definitions

### 6. Tests
- Remove ALL schema-related tests from:
  - `test/cc.test.ts`
  - `test/loader.test.ts`
  - `test/prompt-builder.test.ts`
  - Any other test files with schema validation
- Remove test fixtures that use output schemas

### 7. Examples
- Update or remove examples that demonstrate schema validation:
  - `examples/basic-usage.ts` - Remove Example 3
  - `examples/file-based-usage.ts` - Remove validation examples
  - `examples/quick-start.ts` - Remove Example 4
  - Any `.md` files in examples with output frontmatter

### 8. Documentation
- Update `README.md`:
  - Remove schema validation from features list
  - Remove schema examples
  - Remove Zod from key features
  - Update API reference
- Update any other documentation files

### 9. Dependencies
- Check if Zod is still needed after removal
- If not used elsewhere, remove from package.json
- Update package-lock.json / bun.lockb

## Implementation Checklist

### Phase 1: Core Removal
- [ ] Remove schema fields from all interfaces in types.ts
- [ ] Remove validate() method from CC class
- [ ] Remove schema validation logic from run() and fromFile()
- [ ] Remove withOutputSchema() from PromptBuilder
- [ ] Remove output field from frontmatter processing

### Phase 2: Test Cleanup
- [ ] Remove all schema validation tests
- [ ] Update test fixtures that use output schemas
- [ ] Ensure all tests still pass after removal
- [ ] Remove any mock schema objects

### Phase 3: Documentation
- [ ] Update README.md to remove all schema references
- [ ] Update example files to remove schema demos
- [ ] Search for "schema", "validate", "validation", "Zod" across all docs
- [ ] Update CHANGELOG to note deprecation

### Phase 4: Final Cleanup
- [ ] Search entire codebase for "outputSchema"
- [ ] Search entire codebase for "withOutputSchema"
- [ ] Search entire codebase for "validate("
- [ ] Search entire codebase for "z.object" in examples
- [ ] Check if Zod can be removed entirely
- [ ] Run full test suite
- [ ] Run all examples to ensure they work

## Search Commands for Verification

Use these commands to ensure complete removal:

```bash
# Find any remaining schema references
grep -r "outputSchema" src/ test/ examples/
grep -r "withOutputSchema" src/ test/ examples/
grep -r "validate(" src/ test/ examples/
grep -r "warnings" src/ test/ examples/

# Find Zod usage
grep -r "from 'zod'" src/ test/ examples/
grep -r "z\." src/ test/ examples/

# Find in markdown files
grep -r "schema" *.md examples/*.md
```

## Migration Guide for Users

Add to CHANGELOG.md:
```markdown
## Breaking Changes

- Removed output schema validation feature. If you were using `withOutputSchema()` or `outputSchema` in frontmatter, you'll need to validate responses manually:

```typescript
// Before
const result = await cc.prompt`...`.withOutputSchema(schema).run();

// After
const result = await cc.prompt`...`.run();
const validated = schema.parse(result.data); // Do your own validation
```
```

## Success Criteria

1. **Zero schema references** - No outputSchema, withOutputSchema, or schema validation code remains
2. **All tests pass** - Existing functionality unaffected
3. **Examples work** - All example files run without errors
4. **Clean git diff** - Only schema-related code removed, no unrelated changes
5. **No orphaned imports** - Remove Zod if no longer needed

## Notes

- Be thorough - use search commands to find all references
- Don't just comment out code - remove it entirely
- Update examples to show best practices without schema validation
- This is a breaking change - document it clearly
- Consider if any other features depend on schema validation
