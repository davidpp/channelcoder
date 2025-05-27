---
input:
  name: string
  age?: number
  active?: boolean
---

Hello {name}, age: {age || 'unknown'}