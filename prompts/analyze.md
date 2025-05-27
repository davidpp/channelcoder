---
input:
  taskId: string
  context: string
systemPrompt: You are a helpful code analyst
allowedTools:
  - Read
  - Grep
---

# Task Analysis: {taskId}

Please analyze the following context:

{context}

Provide:
1. Summary of the task
2. Key considerations
3. Suggested approach