---
allowedTools:
  - Read
  - Write
  - Edit
  - MultiEdit
  - Bash
  - Grep
  - Glob
  - TodoWrite
  - TodoRead
  # Scopecraft MCP tools for task management
  - mcp__scopecraft-cmd__task_list
  - mcp__scopecraft-cmd__task_get
  - mcp__scopecraft-cmd__task_update
  - mcp__scopecraft-cmd__task_move
  - mcp__scopecraft-cmd__task_next
  - mcp__scopecraft-cmd__workflow_current
  - mcp__scopecraft-cmd__phase_list
  - mcp__scopecraft-cmd__feature_list
---

# Implement ChannelCoder Task

You're implementing a task for the ChannelCoder SDK. The task details are below:

<task-details>
{taskContent}
</task-details>

## Implementation Guidelines

**Start with TodoWrite** to break down this task into concrete steps. Your todo list should include:
- Specific code changes (file by file)
- Test updates required
- Documentation updates
- Verification steps

**Work systematically** through your todos, marking items as "in_progress" when starting and "completed" when done.

## Key Constraints

- Code must work in both Node.js and Bun (no Bun-specific APIs)
- Run `bun run check` before finalizing
- Test changes with relevant examples in `examples/`
- Update tests for any new functionality

## When Complete

Summarize:
1. What was implemented
2. Any deviations from the task specification
3. Example usage (if applicable)
4. Any follow-up tasks needed

Begin by analyzing the task and creating your implementation plan with TodoWrite.