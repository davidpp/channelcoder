# SDK Bugs Found During Testing

## 1. Nested Object Validation Not Working
**Test:** `validation.test.ts` - "validates nested objects"
**Issue:** When defining nested object schemas in frontmatter like:
```yaml
input:
  user:
    name: string
    email: string
```
The loader treats `user` as a string instead of recognizing it as a nested object schema.

**Expected:** Should validate nested object properties
**Actual:** Treats nested schemas as strings, causing validation to fail with "Expected string, received object"

## 2. ✅ FIXED: System Prompt from Frontmatter Not Included in Dry-Run Commands
**Test:** `validation.test.ts` - "frontmatter system prompt works"
**Issue:** When a prompt file includes `systemPrompt` in frontmatter:
```yaml
systemPrompt: You are a helpful assistant
```
The generated dry-run command doesn't include `--system-prompt` flag.

**Root Cause:** In `functions.ts`, the `convertOptions` function maps `options.system` to `systemPrompt`, which is `undefined` when using file-based prompts. When merging options with `{ ...config, ...mergedOptions }`, the `undefined` value overwrites the `systemPrompt` from the frontmatter.

**Location:** `src/functions.ts` line 123
```typescript
// This causes undefined values to overwrite frontmatter values
mergedOptions = { ...config, ...mergedOptions };
```

**Fix:** Either:
1. Filter out undefined values before merging
2. Change merge order to `{ ...mergedOptions, ...config }` so frontmatter takes precedence
3. Only include defined values in `promptConfig` object

**Expected:** Command should include `--system-prompt "You are a helpful assistant"`
**Actual:** System prompt is missing from the generated command

## 3. ✅ FIXED: Optional Field Key Names Not Normalized
**Test:** `loader.test.ts` - "should parse input schema from YAML notation"
**Issue:** When parsing schemas with optional fields using `?` notation:
```yaml
input:
  optional?: boolean
```
The loader keeps the `?` in the property name instead of stripping it.

**Expected:** Schema should have property "optional" (without the ?)
**Actual:** Schema likely has property "optional?" (with the ?), causing the test to fail when looking for "optional"

## Summary
These bugs indicate that:
1. The YAML schema parser needs to handle nested object definitions
2. The dry-run command generation needs to include all frontmatter options
3. The schema parser needs to properly handle optional field notation