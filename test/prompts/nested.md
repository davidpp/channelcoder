---
input:
  user:
    name: string
    email: string
  settings:
    theme: string
    notifications: boolean
---

User: {user.name} ({user.email})
Theme: {settings.theme}