---
session:
  required: true
systemPrompt: |
  You are helping with an ongoing development task.
  Use the conversation history to understand what we've been working on.
---

# Continue Our Work

Based on our previous discussion, please continue with the next steps.

Last message context: {session.lastMessage || 'No previous messages found'}

What should we focus on next?