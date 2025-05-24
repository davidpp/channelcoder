---
# Define input schema for validation
input:
  currentVersion: string
  lastTag: string
  commits: string
  fileChanges: string
  targetVersion?: string

# Define expected output structure
output:
  success: boolean
  recommendedVersion: string
  changeType: string
  confidence: string
  reasoning: string
  breakingChanges: boolean
  highlights: string[]

# System prompt for consistent analysis
systemPrompt: |
  You are a semantic versioning expert. Analyze code changes and recommend
  appropriate version bumps following these rules:
  - Breaking changes → MAJOR (1.0.0 → 2.0.0)
  - New features → MINOR (1.0.0 → 1.1.0)
  - Bug fixes → PATCH (1.0.0 → 1.0.1)
  - No changes → NONE (keep current version)

# Allow tools for additional analysis if needed
allowedTools:
  - Read
  - Grep
---

# Release Version Analysis

## Current Status
- **Current Version**: ${currentVersion}
- **Last Release Tag**: ${lastTag}
${targetVersion ? `- **Target Version**: ${targetVersion} (please validate)` : ""}

## Recent Commits Since ${lastTag}

```
${commits}
```

## File Changes Summary

```
${fileChanges}
```

## Analysis Task

Please analyze the commits and changes above to:

1. **Categorize Changes**:
   - Identify any breaking changes (API changes, removed features)
   - List new features or capabilities added
   - Note bug fixes and improvements

2. **Recommend Version**:
   - Based on semantic versioning rules
   - Consider the most significant change type

3. **Provide Confidence Level**:
   - HIGH: Clear change patterns
   - MEDIUM: Some ambiguity
   - LOW: Unclear signals

${targetVersion ? `
4. **Validate Target Version**:
   - Check if ${targetVersion} aligns with the changes
   - Flag any concerns if version seems incorrect
` : ""}

## Required Output

Respond with a JSON object containing your analysis:

```json
{
  "success": true,
  "recommendedVersion": "X.Y.Z",
  "changeType": "major|minor|patch|none",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of the recommendation",
  "breakingChanges": true|false,
  "highlights": [
    "Key change or feature 1",
    "Key change or feature 2"
  ]
}
```