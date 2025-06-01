# CLI Session Resume Examples

This document shows how to use the CLI's session resume functionality.

## Resume by Session ID

Resume a conversation using the Claude session ID:

```bash
# Resume an existing conversation
channelcoder -r "session-id-here"

# Resume with additional prompt
channelcoder -r "session-id-here" -p "Continue analyzing the issue"

# Resume with a prompt file
channelcoder -r "session-id-here" prompts/continue.md
```

## Continue Most Recent Session

Continue the most recent conversation:

```bash
# Continue last conversation
channelcoder -c

# Continue with new prompt
channelcoder -c -p "What was the conclusion?"
```

## ChannelCoder Session Management

For ChannelCoder-managed sessions (recommended):

```bash
# Create a named session
channelcoder --session my-debug prompts/debug.md

# Load and continue a session
channelcoder --load-session my-debug prompts/continue.md

# List all saved sessions
channelcoder --list-sessions
```

## Key Differences

### Claude Session ID vs ChannelCoder Session
- **Claude Session ID** (`-r`): Raw Claude conversation ID, resume specific Claude session
- **ChannelCoder Session** (`--session`/`--load-session`): Managed by ChannelCoder with metadata and history

### When to Use Each
- Use `-r` when you have a Claude session ID from logs or previous runs
- Use `--session`/`--load-session` for organized, named session management
- Use `-c` as a quick way to continue the last conversation

## Examples

```bash
# Start a debugging session
channelcoder --session debug-auth prompts/debug.md

# Continue the debugging session later
channelcoder --load-session debug-auth -p "Check the authentication flow"

# Resume a specific Claude session from logs
channelcoder -r "9531985d-d7b6-4f6f-8edc-1a816c88f1ff"

# Quick continue
channelcoder -c -p "Summarize what we discovered"
```