+++
id = "FEAT-ADDNODEJS-0523-HU"
title = "Add Node.js compatibility to ChannelCoder SDK and CLI"
type = "🌟 Feature"
status = "🔵 In Progress"
priority = "🔼 High"
created_date = "2025-05-23"
updated_date = "2025-05-23"
assigned_to = "david"
tags = [ "nodejs", "compatibility", "build-system", "cli" ]
+++

# Add Node.js compatibility to ChannelCoder SDK and CLI

## Overview
Currently, ChannelCoder uses Bun-specific APIs (Bun.spawn) and requires Bun runtime. This task adds full Node.js compatibility by replacing Bun APIs with Node.js APIs that work in both environments.

## Acceptance Criteria
- [x] SDK works in Node.js 18+ environments
- [x] CLI executable works with Node.js
- [x] Dual CJS/ESM package distribution
- [ ] All tests pass in both Node.js and Bun
- [ ] Documentation updated with Node.js examples

## Technical Approach
- Use tsup for dual CJS/ESM builds
- Replace Bun.spawn with child_process.spawn (works in both Bun and Node.js)
- Update package.json with proper exports map
- Change CLI shebang to #!/usr/bin/env node

## Implementation Steps

### Phase 1: Build System Setup ✅
- [x] Add tsup as dev dependency
- [x] Configure tsup for dual CJS/ESM output
- [x] Update package.json exports and main fields
- [x] Verify build outputs are correct

### Phase 2: Replace Bun APIs with Node.js APIs ✅
- [x] Replace Bun.spawn with child_process.spawn
- [x] Remove runtime detection complexity
- [x] Test spawn functionality in both runtimes
- [x] Fixed Claude CLI version issue (0.2.126 → 1.0.2)

### Phase 3: SDK Distribution ✅
- [x] Build and test CJS format in Node.js
- [x] Build and test ESM format in Node.js
- [x] Verify TypeScript definitions work correctly
- [x] Test in a sample Node.js project

### Phase 4: CLI Compatibility ✅
- [x] Update CLI shebang to #!/usr/bin/env node
- [x] Build CLI to dist/ folder
- [x] Update bin paths in package.json
- [x] Test CLI execution in Node.js
- [x] Verify both inline and file-based prompts work
- [x] Confirm JSON output parsing works correctly

### Phase 5: Testing & CI
- [ ] Add Node.js test runner configuration
- [ ] Create GitHub workflow for Node.js tests
- [ ] Test on Windows with Node.js
- [ ] Verify all existing tests pass

### Phase 6: Documentation
- [ ] Update README with Node.js installation instructions
- [ ] Add Node.js usage examples
- [ ] Document any limitations
- [ ] Create migration guide if needed

## Progress Notes
- Successfully replaced Bun.spawn with child_process.spawn
- Added better error reporting for Claude CLI errors
- Fixed "Invalid model name" error by updating Claude CLI to v1.0.2
- Tested CLI with: `node dist/cli.cjs -p "What is 2+2?" --json`
- Tested SDK with ESM imports in Node.js
- All core functionality verified working in Node.js

## Dependencies
- tsup (for building)

## Estimated Effort
- Build system: 2-4 hours ✅
- Replace Bun APIs: 1-2 hours ✅
- Testing: 2-3 hours (in progress)
- Documentation: 1-2 hours
Total: 6-11 hours
