---
allowedTools: 
  - "Bash(git log:*)"
  - "Bash(git diff:*)" 
  - "Bash(git show:*)"
  - "Bash(cd:*)"
  - "Read"
  - "Write"
systemPrompt: You are a release automation assistant. Analyze git changes and create release files.
---

# URGENT: Complete Release Analysis Task

**YOUR TASK**: Analyze git changes since v{LAST_TAG} and create THREE FILES immediately.

## Context
- Current Version: {CURRENT_VERSION}
- Last Tag: {LAST_TAG}  
- Release Date: {RELEASE_DATE}
- Target Version: {REQUESTED_VERSION || 'auto-detect'}

## Step 1: Analyze Changes
Run these commands to understand the changes:
```bash
git log {LAST_TAG}..HEAD --oneline
git diff {LAST_TAG}..HEAD --stat
```

## Step 2: Create Files IMMEDIATELY

You MUST create these three files:

### 1. Create `.release/version.json`
```json
{
  "current_version": "{CURRENT_VERSION}",
  "new_version": "X.Y.Z",
  "bump_type": "major|minor|patch",
  "confidence": "high|medium|low", 
  "reasoning": "Brief explanation",
  "breaking_changes": false,
  "notable_features": ["feature1", "feature2"]
}
```

### 2. Create `.release/changelog.md`
Standard changelog format focusing on USER-FACING changes only:
```markdown
## [X.Y.Z] - {RELEASE_DATE}

### Added
- **Feature Name**: User benefit description

### Changed  
- **Feature Name**: What changed for users

### Fixed
- **Issue Area**: What was broken and now works
```

### 3. Create `.release/metadata.json`
```json
{
  "success": true,
  "version": "X.Y.Z",
  "release_date": "{RELEASE_DATE}",
  "summary": "One-line release summary",
  "breaking_changes": false,
  "highlights": ["Most important change", "Second most important"],
  "categories_used": ["Added", "Fixed"],
  "total_changes": 5,
  "commit_count": 10,
  "files_changed": 15
}
```

## CRITICAL INSTRUCTIONS

1. **START IMMEDIATELY** - Do not ask questions or seek clarification
2. **CREATE ALL THREE FILES** - Use the Write tool to create each file
3. **FOCUS ON USER IMPACT** - Changes to these paths ARE user-facing:
   - `src/` - Core SDK and CLI functionality
   - `examples/` - Example code that users reference  
   - `dist/` - Built artifacts
   - Changes to scripts/, test/, or internal configs are NOT user-facing unless they fix bugs
4. **USE SEMANTIC VERSIONING** - Major (breaking), Minor (features), Patch (fixes)

**BEGIN NOW** - Create the three files based on your git analysis.