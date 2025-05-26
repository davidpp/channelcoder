+++
id = "FEAT-REDESIGNSDK-0526-BC"
title = "Redesign SDK to Function-Based API"
type = "🌟 Feature"
status = "🟢 Done"
priority = "🔼 High"
created_date = "2025-05-26"
updated_date = "2025-05-26"
assigned_to = ""
phase = "release-v2"
+++

# Redesign SDK to Function-Based API

## Goal
Replace the current class-based SDK with simple functions that mirror Claude CLI usage, WITHOUT wrapping the CC class.

## Problem
- Current implementation in functions.ts is just wrapping CC class
- This creates unnecessary complexity and validation issues
- Not following the intended design in docs/sdk-structure.md

## New Implementation Approach

### 1. Extract Validation Logic
Create `src/utils/validation.ts`:
```typescript
export function validateInput(schema, input): ValidationResult
export function validateOutput(result, schema): ValidationResult
```

### 2. Refactor functions.ts
- Remove CC class dependency entirely
- Use CCProcess directly for execution
- Use PromptTemplate directly for interpolation
- Use validation utils for Zod validation

### 3. Update CCProcess
- Make `buildCommand()` method public
- Ensure all execution modes work properly

### 4. Direct Implementation
```typescript
// functions.ts flow:
// 1. Detect file vs inline prompt
// 2. Load file if needed (loadPromptFile)
// 3. Validate input if schema exists
// 4. Interpolate template (PromptTemplate)
// 5. Execute via CCProcess directly
```

### 5. Handle Launch Modes
- Interactive: Use spawnSync with stdio: 'inherit'
- Stream: Use CCProcess.stream()
- Run: Use CCProcess.execute()
- Background/Detached: Use spawn with appropriate options

### 6. Deprecate Classes
- Mark CC class as @deprecated
- Mark PromptBuilder as @deprecated
- Keep them for now but don't use in new code

## Implementation Tasks

- [x] Analyze CC class dependencies
- [ ] Create src/utils/validation.ts with extracted logic
- [ ] Update CCProcess to expose buildCommand publicly
- [ ] Refactor functions.ts to work without CC class
- [ ] Ensure all tests pass
- [ ] Update any remaining examples if needed
- [ ] Add deprecation notices to old classes

## Testing
```bash
bun test validation.test.ts  # Test validation works
bun test functions-real.test.ts  # Test real execution
bun run implement FEAT-REDESIGNSDK-0526-BC  # Dogfood test
```

## Success Criteria
- [ ] No CC class usage in functions.ts
- [ ] All validation tests pass
- [ ] All function tests pass
- [ ] implement.ts script works correctly
- [ ] Clean, direct implementation matching docs/sdk-structure.md
