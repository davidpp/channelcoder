+++
id = "BUG-FIXCLI-0523-JW"
title = "Fix CLI installation issues"
type = "🐞 Bug"
status = "🔵 In Progress"
priority = "🔼 High"
created_date = "2025-05-23"
updated_date = "2025-05-23"
assigned_to = ""
phase = "backlog"
tags = [ "cli", "installation", "npm" ]
+++

# Fix CLI installation issues

## Problem Description

Two issues were discovered when installing channelcoder globally via npm:

1. **CC command conflict**: The `cc` alias conflicts with the C compiler (`/usr/bin/cc`) on macOS
2. **CLI not executing**: After global install, `channelcoder` command exits silently with no output due to faulty module detection logic

## Root Causes

### Issue 1: CC Conflict
- Package.json defines `"cc": "./dist/cli.cjs"` which overwrites system `cc` command
- This conflicts with clang/gcc compiler toolchain

### Issue 2: Silent Failure
- The `isMainModule` check in `src/cli.ts` fails when run via npm global install
- When installed globally, `process.argv[1]` contains the symlink path (e.g., `/opt/homebrew/bin/channelcoder`)
- The check only looks for paths ending with `/cli.cjs` or `/cli.mjs`
- Since symlink doesn't match, `main()` never executes

## Action Plan

### 1. Remove CC alias
- Remove `"cc": "./dist/cli.cjs"` from package.json bin section
- Update README.md to remove all references to `cc` alias
- Update CLI help text in src/cli.ts to remove `cc` mentions

### 2. Fix module detection
- Simplify the module detection in src/cli.ts
- Since this is a CLI tool, just execute main() directly:
```javascript
// Run CLI
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

### 3. Test the fixes
- Build the package
- Test local install with `npm link`
- Verify channelcoder command works
- Ensure cc command is not created

## Files to Modify
1. `package.json` - Remove cc from bin section
2. `README.md` - Remove cc alias references
3. `src/cli.ts` - Remove cc from help text and fix module detection
