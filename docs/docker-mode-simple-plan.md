# Docker Mode - Simple Implementation Plan

## Core Idea

Add a `docker` option to channelcoder that runs the claude CLI inside a user-provided Docker container. The library just handles the Docker wrapping - users bring their own container setup.

## How It Works

```typescript
// User provides their own Docker image with claude installed
await claude('Do risky stuff with full permissions', {
  docker: {
    image: 'my-claude-sandbox:latest',  // User's custom image
    mounts: ['./workspace:/workspace'],  // What to mount
  }
});
```

## Implementation Approach

### 1. Extend CCProcess

In `src/process.ts`, add Docker support:

```typescript
// Check if docker mode requested
if (options.docker) {
  return this.executeInDocker(prompt, options);
}

private async executeInDocker(prompt: string, options: CCOptions & { docker: DockerOptions }) {
  const dockerArgs = [
    'run', '--rm', '-i',
    ...this.buildDockerMounts(options.docker.mounts),
    options.docker.image,
    ...await this.buildCommand(options)  // Regular claude args
  ];
  
  // Spawn docker instead of claude directly
  const proc = spawn('docker', dockerArgs);
  // ... handle stdin/stdout/stderr as normal
}
```

### 2. Minimal API Addition

```typescript
interface DockerOptions {
  image: string;           // User's Docker image
  mounts?: string[];       // Volume mounts
  env?: Record<string, string>;  // Environment vars
}

interface ClaudeOptions {
  // ... existing options
  docker?: DockerOptions;  // New option
}
```

### 3. Key Features to Handle

- **Streaming**: Should work the same through Docker stdin/stdout
- **Interactive mode**: Use `docker run -it` for TTY
- **Environment**: Pass ANTHROPIC_API_KEY through `-e` flag
- **Cleanup**: Use `--rm` flag for auto-cleanup

### 4. User Documentation

```markdown
## Docker Mode

Run Claude in a Docker container for isolated execution:

1. Create your own Docker image with Claude CLI:
   ```dockerfile
   FROM node:20
   RUN npm install -g @anthropic-ai/claude-code
   # Add any tools you want available
   ```

2. Use docker mode:
   ```typescript
   await claude('Risky operation', {
     docker: {
       image: 'my-claude:latest',
       mounts: ['./data:/data:ro']
     }
   });
   ```

The library handles Docker execution, you control the environment.
```

## What We're NOT Doing

- Providing Docker images
- Managing container lifecycle beyond single commands  
- Complex orchestration
- Security policies (users handle their own)
- Resource management (users set their own limits)

## Implementation Steps

1. Add `DockerOptions` type to `types.ts`
2. Extend `CCProcess.execute()` to check for docker mode
3. Implement `executeInDocker()` method
4. Handle streaming/interactive modes with appropriate docker flags
5. Add basic tests with mock docker commands
6. Update README with simple example

## Estimated Work

- ~2-3 hours for basic implementation
- ~1 hour for testing
- ~30 mins for documentation

Total: Half day of work

## Example Usage Scenarios

```typescript
// Run with all permissions in isolated environment
await claude('Delete unnecessary files', {
  docker: {
    image: 'claude-sandbox',
    mounts: ['./project:/workspace']
  },
  tools: ['*']  // All tools allowed in container
});

// Stream from container
for await (const chunk of stream('Analyze system', {
  docker: { image: 'claude-tools:latest' }
})) {
  console.log(chunk.content);
}
```

## Testing Approach

```typescript
// Mock docker spawn in tests
spyOn(child_process, 'spawn').mockImplementation((cmd, args) => {
  if (cmd === 'docker') {
    // Verify docker args built correctly
    expect(args).toContain('run');
    expect(args).toContain('--rm');
    // Return mock process
  }
});
```

That's it. Simple, focused, and lets users control their own Docker setup while we just handle the integration.