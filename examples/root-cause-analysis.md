---
# Root Cause Analysis Prompt Template
input:
  errorMessage: string
  stackTrace?: string
  suspectedFile?: string
  searchPattern: string
  contextInfo?: string

output:
  success: boolean
  rootCause:
    file: string
    line: number
    description: string
  callTrace: 
    - file: string
      function: string
      line: number
  hypothesis: string
  suggestedFix: string
  relatedFiles: string[]
  confidence: string

systemPrompt: |
  You are a senior software engineer performing root cause analysis.
  Trace through code systematically, following function calls and data flow.
  Focus on understanding the complete context before forming hypotheses.
  Be thorough but concise in your analysis.

# Only allow read operations - no modifications during analysis
allowedTools:
  - "Bash(cd:*)"
  - "Bash(pwd)"
  - "Bash(ls:*)"
  - "Bash(find:*)"
  - "Bash(rg:*)"        # ripgrep for fast searching
  - "Bash(grep:*)"
  - "Bash(git log:*)"
  - "Bash(git show:*)"
  - "Bash(git blame:*)"
  - Read
  - Grep
  - Glob
---

# Root Cause Analysis Request

## Error Context

**Error Message**: ${errorMessage}

${stackTrace ? `**Stack Trace**:
\`\`\`
${stackTrace}
\`\`\`` : ""}

${suspectedFile ? `**Suspected File**: ${suspectedFile}` : ""}

${contextInfo ? `**Additional Context**: ${contextInfo}` : ""}

## Analysis Tasks

Please perform a thorough root cause analysis by:

1. **Search for the error pattern**:
   - Look for: `${searchPattern}`
   - Check error handling code
   - Find where this error is thrown/logged

2. **Trace the call stack**:
   - Start from ${suspectedFile || "the error location"}
   - Follow function calls backwards
   - Identify the chain of events

3. **Examine related code**:
   - Check recent changes (git log/blame)
   - Look for similar patterns
   - Identify dependencies

4. **Form a hypothesis**:
   - What is the most likely root cause?
   - What conditions trigger this error?
   - Are there any race conditions or edge cases?

5. **Suggest a fix**:
   - Provide specific recommendations
   - Consider edge cases
   - Note any potential side effects

## Required Output

Provide a comprehensive analysis in JSON format:

```json
{
  "success": true,
  "rootCause": {
    "file": "path/to/file.ts",
    "line": 42,
    "description": "Clear explanation of the root cause"
  },
  "callTrace": [
    {
      "file": "path/to/caller.ts",
      "function": "functionName",
      "line": 100
    }
  ],
  "hypothesis": "Detailed hypothesis about why this error occurs",
  "suggestedFix": "Specific fix recommendation",
  "relatedFiles": ["file1.ts", "file2.ts"],
  "confidence": "high|medium|low"
}
```