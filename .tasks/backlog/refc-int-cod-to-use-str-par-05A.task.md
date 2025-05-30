# Refactor Internal Code to Use Stream Parser SDK

---
type: "\U0001F9F9 Chore"
status: To Do
area: core
priority: Medium
tags:
  - refactoring
  - parser
  - tech-debt
  - cleanup
---


## Instruction
## Context

Once the Stream Parser SDK (task: implmnt-str-par-sdk-for-cla-05A) is implemented, we need to refactor internal code to use the new public parser utilities instead of duplicating parsing logic. This will:

1. Reduce code duplication
2. Ensure consistent parsing behavior
3. Dogfood our own public API
4. Make the codebase smaller and more maintainable

## Current State

The following internal components currently have their own parsing logic:

1. **CCProcess class** (`src/process.ts`)
   - `parseStreamLine()` method (lines 507-540+)
   - `parseOutput()` method (lines 485-502)
   - Session ID extraction logic (lines 192-234)

2. **Stream handling** in `executeStream()` (lines 325-380)
   - Inline parsing of JSON lines
   - Custom chunk creation

3. **Session tracking** in various places
   - Duplicate session ID extraction patterns

## Objective

Refactor all internal parsing logic to use the new Stream Parser SDK, removing duplicate code and improving maintainability.

## Dependencies

- **Blocked by**: implmnt-str-par-sdk-for-cla-05A (Stream Parser SDK must be implemented first)
- The new parser SDK must be fully tested and stable before refactoring

## Implementation Plan

### Phase 1: Analyze and Map Usage

1. Identify all places using `parseStreamLine()` or similar parsing
2. Map current usage patterns to new SDK functions
3. Identify any internal-only features that need to be preserved
4. Create migration checklist

### Phase 2: Refactor CCProcess

1. **Replace `parseStreamLine()` method**:
   ```typescript
   // OLD: Internal method
   private parseStreamLine(line: string): StreamChunk { ... }
   
   // NEW: Use SDK
   import { parseStreamEvent, eventToChunk } from './stream-parser';
   ```

2. **Update `parseOutput()` method**:
   - Check if still needed or can use SDK utilities
   - May need to keep for non-streaming JSON extraction

3. **Refactor session ID extraction**:
   ```typescript
   // OLD: Manual parsing in multiple places
   // NEW: Use parsed event's session_id field
   const event = parseStreamEvent(line);
   if (event?.session_id) { ... }
   ```

### Phase 3: Update Stream Execution

1. **Refactor `executeStream()` method**:
   ```typescript
   // OLD: Manual line parsing
   for await (const line of this.readStreamLines(child)) {
     yield this.parseStreamLine(line);
   }
   
   // NEW: Use SDK generators
   import { parseEventStream, eventsToChunks } from './stream-parser';
   const events = parseEventStream(this.readStreamLines(child));
   for await (const chunk of eventsToChunks(events)) {
     yield chunk;
   }
   ```

2. **Update error handling** to work with SDK patterns

### Phase 4: Session Integration Updates

1. Update session manager to use SDK types
2. Remove duplicate session ID extraction
3. Consider adding session sync utilities

### Phase 5: Cleanup

1. **Remove deprecated methods**:
   - Delete `parseStreamLine()` from CCProcess
   - Remove inline parsing logic
   - Clean up duplicate type definitions

2. **Update imports** throughout codebase

3. **Ensure backward compatibility**:
   - StreamChunk type should remain unchanged
   - Public API behavior must not change

## Testing Requirements

1. **Regression Tests**:
   - All existing tests must pass
   - Streaming behavior unchanged
   - Session tracking works as before

2. **Integration Tests**:
   - Test refactored code with real Claude CLI
   - Verify session ID extraction
   - Check streaming performance

3. **Compatibility Tests**:
   - Ensure Node.js and Bun compatibility
   - Test with various Claude output formats

## Migration Checklist

- [ ] Stream Parser SDK is complete and tested
- [ ] Map all internal parsing usage
- [ ] Create compatibility layer if needed
- [ ] Refactor parseStreamLine usage
- [ ] Refactor parseOutput usage  
- [ ] Update session ID extraction
- [ ] Refactor executeStream method
- [ ] Remove duplicate code
- [ ] Update all imports
- [ ] Run full test suite
- [ ] Performance benchmarks
- [ ] Update internal documentation

## Benefits

1. **Code Reduction**: Remove ~200 lines of duplicate parsing code
2. **Consistency**: Single source of truth for parsing logic
3. **Maintainability**: Easier to update parsing in one place
4. **Dogfooding**: We use our own public API
5. **Type Safety**: Leverage SDK's comprehensive types

## Risks

1. **Risk**: Breaking changes to internal behavior
   - **Mitigation**: Comprehensive regression testing

2. **Risk**: Performance regression
   - **Mitigation**: Benchmark before and after

3. **Risk**: Circular dependencies
   - **Mitigation**: Ensure parser SDK has no internal dependencies

## Tasks
- [ ] Wait for Stream Parser SDK completion
- [ ] Audit all parseStreamLine usage in codebase
- [ ] Audit all parseOutput usage
- [ ] Map internal patterns to SDK functions
- [ ] Update CCProcess to import SDK parser
- [ ] Replace parseStreamLine with parseStreamEvent
- [ ] Refactor session ID extraction logic
- [ ] Update executeStream to use SDK generators
- [ ] Remove parseStreamLine method from CCProcess
- [ ] Remove duplicate StreamChunk creation
- [ ] Update all imports to use SDK
- [ ] Run regression test suite
- [ ] Benchmark streaming performance
- [ ] Test Node.js and Bun compatibility
- [ ] Update code comments and docs
- [ ] Remove deprecated parsing code

## Deliverable
## Expected Deliverables

1. **Refactored Code**:
   - Updated `src/process.ts` using SDK parsers
   - Removed internal parsing methods
   - Cleaner stream execution flow

2. **Code Reduction**:
   - ~200 lines of parsing code removed
   - No duplicate session ID extraction
   - Simplified stream handling

3. **Documentation**:
   - Updated code comments
   - Migration notes for future reference

4. **Testing**:
   - All tests passing
   - No performance regression
   - Compatibility verified

## Success Criteria

- [ ] All internal parsing uses the public SDK
- [ ] No duplicate parsing code remains
- [ ] All existing tests pass
- [ ] No performance regression (±5%)
- [ ] Code is cleaner and more maintainable

## Log
## Log

### 2025-01-31 - Task Created
- Created refactoring task as follow-up to Stream Parser SDK
- Identified all internal parsing code to be replaced
- Estimated ~200 lines of code to be removed
- Set as blocked by parser SDK implementation
