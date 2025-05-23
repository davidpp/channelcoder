# ChannelCoder Architecture Refactor Proposal

## Executive Summary

This document proposes a refactoring of ChannelCoder from a class-based to a hybrid functional/class architecture. The goal is to simplify the API surface while maintaining powerful features for advanced use cases.

## Current Architecture Issues

### 1. Unnecessary Complexity
- Simple use cases require class instantiation and method chaining
- Multiple classes for what could be simple function calls
- Cognitive overhead for basic "prompt → response" workflows

### 2. Mixing Concerns
- `CC` class handles file loading, template processing, validation, and execution
- Unclear separation between configuration and execution

### 3. API Surface Confusion
- Both `cc.prompt` template literals and `cc.fromFile` methods
- PromptBuilder adds another layer of complexity
- Users need to understand multiple patterns

## Proposed Architecture

### Core Principles
1. **Simple by default** - Basic use cases should be one function call
2. **Progressive disclosure** - Advanced features available when needed
3. **Functional core** - Pure functions for transformations
4. **Class-based infrastructure** - Keep classes for stateful process management

### New API Design

```typescript
// Primary API - Simple function calls
export async function channel(prompt: string, options?: ChannelOptions): Promise<ChannelResult>;
export async function channelFile(path: string, data?: Data, options?: ChannelOptions): Promise<ChannelResult>;
export async function* channelStream(prompt: string, options?: ChannelOptions): AsyncGenerator<StreamChunk>;

// Configuration factory for reuse
export function createChannel(config: ChannelConfig) {
  return {
    send: (prompt: string, options?: ChannelOptions) => channel(prompt, { ...config, ...options }),
    sendFile: (path: string, data?: Data, options?: ChannelOptions) => channelFile(path, data, { ...config, ...options }),
    stream: (prompt: string, options?: ChannelOptions) => channelStream(prompt, { ...config, ...options })
  };
}

// Advanced builder pattern (optional)
export function prompt(strings: TemplateStringsArray, ...values: any[]): PromptBuilder;
```

### Module Structure

```
src/
├── index.ts          # Main exports, simple API
├── channel.ts        # Core channel functions
├── config.ts         # Configuration types and defaults
├── template.ts       # Template interpolation (pure functions)
├── validation.ts     # Schema validation (pure functions)
├── process/
│   ├── manager.ts    # CCProcess class (unchanged)
│   └── stream.ts     # Streaming utilities
├── file/
│   ├── loader.ts     # File loading utilities
│   └── parser.ts     # Frontmatter parsing
└── builder/
    └── prompt.ts     # PromptBuilder for advanced use
```

## Migration Plan

### Phase 1: Add Functional API (Non-breaking)
1. Create new functional exports alongside existing classes
2. Implement functions that internally use existing classes
3. Add deprecation notices to class-based methods
4. Update documentation to prefer functional API

### Phase 2: Internal Refactoring
1. Extract pure functions from classes
2. Move file operations to dedicated module
3. Simplify CC class to configuration holder
4. Improve test coverage with functional approach

### Phase 3: Deprecate Old API (Major version)
1. Remove deprecated class methods
2. Keep CCProcess for backward compatibility
3. Provide migration guide
4. Update all examples

## Impact Analysis

### Breaking Changes (Phase 3 only)
- `new CC()` → `createChannel()`
- `cc.fromFile()` → `channelFile()`
- `cc.prompt`` ` → `prompt`` ` (import change)
- `cc.run()` → `channel()`

### Non-breaking Additions (Phase 1)
- New functional exports work alongside existing API
- Existing code continues to work
- Gradual migration possible

### Benefits
1. **Simpler mental model** - Function in, result out
2. **Better tree-shaking** - Import only what you need
3. **Easier testing** - Pure functions are simpler to test
4. **Type inference** - Better TypeScript experience
5. **Familiar patterns** - Similar to fetch(), fs.readFile(), etc.

## Code Examples

### Before (Current)
```typescript
import { CC } from 'channelcoder';

const cc = new CC({ timeout: 60000 });
const result = await cc.fromFile('prompt.md', { name: 'World' });

// Or with builder
const result2 = await cc.prompt`Hello ${name}`
  .withTools(['Read', 'Write'])
  .run();
```

### After (Proposed)
```typescript
import { channelFile, channel, prompt } from 'channelcoder';

// Simple cases
const result = await channelFile('prompt.md', { name: 'World' });
const result2 = await channel('Hello World');

// With options
const result3 = await channel('Complex prompt', {
  timeout: 60000,
  tools: ['Read', 'Write']
});

// Reusable configuration
const myChannel = createChannel({ timeout: 60000, verbose: true });
const result4 = await myChannel.sendFile('prompt.md', { name: 'World' });

// Advanced builder (when needed)
const result5 = await prompt`Hello ${name}`
  .withTools(['Read', 'Write'])
  .run();
```

## Implementation Priority

1. **High Priority**
   - Core `channel()` function
   - `channelFile()` function
   - Configuration system
   - Documentation updates

2. **Medium Priority**
   - Stream functions
   - Migration guide
   - Deprecation warnings
   - Example updates

3. **Low Priority**
   - Remove deprecated code
   - Performance optimizations
   - Additional utilities

## Risks and Mitigations

### Risk 1: User Confusion During Migration
**Mitigation**: 
- Clear migration guide
- Deprecation warnings with upgrade instructions
- Support both APIs during transition period

### Risk 2: Breaking Existing Integrations
**Mitigation**:
- Phase approach allows gradual migration
- Major version bump for breaking changes
- Compatibility layer for common patterns

### Risk 3: Loss of Features
**Mitigation**:
- All current features remain available
- Advanced patterns still possible
- Keep class-based process management

## Success Metrics

1. **API Simplicity**: Reduce lines of code for common use cases by 50%
2. **Adoption**: 80% of examples use functional API
3. **Performance**: No regression in execution speed
4. **Bundle Size**: 20% reduction through better tree-shaking
5. **Type Safety**: Improved inference in 90% of use cases

## Timeline

- **Week 1-2**: Implement functional API alongside existing
- **Week 3**: Update documentation and examples
- **Week 4**: Beta release with deprecation notices
- **Month 2**: Gather feedback and refine
- **Month 3**: Major version release with breaking changes

## Conclusion

This refactor will make ChannelCoder more approachable for new users while maintaining power for advanced use cases. The functional-first approach aligns with modern JavaScript patterns and provides a cleaner, more intuitive API.