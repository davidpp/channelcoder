---
allowedTools: [Read, Write]
systemPrompt: Test system prompt
---

# Test Prompt

Task ID: {taskId}
Priority: {priority || 'normal'}

{#if includeDetails}
This includes details.
{#endif}