---
# Input schema - validates data before sending
input:
  taskId: string
  context: string
  includeDetails?: boolean

# Output schema - parses and validates response
output:
  success: boolean
  analysis:
    type: string
    enum: [feature, bugfix, chore, documentation]
  summary: string
  steps: string[]

# System prompt from file
systemPrompt: "You are a task analysis expert. Provide structured analysis."

# Allowed tools
allowedTools:
  - Read
  - Grep
---

# Task Analysis

Analyze task **${taskId}** with the following context:

${context}

${includeDetails ? "Include detailed implementation steps." : ""}

Provide your analysis in the following JSON format:

```json
{
  "success": true,
  "analysis": {
    "type": "feature|bugfix|chore|documentation"
  },
  "summary": "Brief summary of the task",
  "steps": ["step1", "step2", "..."]
}
```