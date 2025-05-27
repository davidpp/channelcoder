---
input:
  tags:
    type: array
  status:
    type: string
    enum: [active, inactive]
  count:
    type: number
    min: 0
    max: 100
---

Tags: {tags}
Status: {status}
Count: {count}