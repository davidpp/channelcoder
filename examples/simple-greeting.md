---
input:
  name: string
  greeting?: string

systemPrompt: "You are a friendly assistant. Respond concisely."

allowedTools:
  - Read
---

# Simple Test

${greeting || "Hello"}, ${name}!

Please respond with a simple greeting back.