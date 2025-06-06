# Docker SDK Architecture

## Overview

The Docker integration in ChannelCoder follows the same composable, Unix-like philosophy as the rest of the SDK. It treats Docker as just another execution environment, maintaining simplicity while enabling powerful isolation capabilities.

## Design Principles

### 1. **Simple by Default**
```typescript
// Just works - auto-detects Dockerfile
await claude('Analyze codebase', { docker: true });
```

### 2. **Progressive Enhancement**
```typescript
// Start simple
await claude('Task', { docker: true });

// Add configuration as needed
await claude('Task', { 
  docker: { 
    image: 'my-claude',
    mounts: ['./data:/data:ro'] 
  } 
});
```

### 3. **Unix Philosophy**
- Docker is just another pipe in the command chain
- Composable with all existing features (sessions, streaming, etc.)
- Transparent command construction
- No hidden magic

### 4. **Zero Lock-in**
- Docker mode is optional
- Same API surface with or without Docker
- Easy to switch between modes

## Architecture Components

### DockerManager (`src/docker.ts`)

Handles Docker-specific operations:
- **Auto-detection**: Finds Dockerfiles automatically
- **Image building**: Builds and caches images
- **Configuration resolution**: Handles options and defaults
- **Volume mounting**: Manages workspace and custom mounts

```typescript
class DockerManager {
  async checkDockerAvailable(): Promise<boolean>
  async resolveDockerConfig(options: boolean | DockerOptions): Promise<ResolvedDockerConfig>
  buildDockerArgs(config: ResolvedDockerConfig, interactive: boolean): string[]
  async buildImage(dockerfilePath: string, imageName: string): Promise<boolean>
  async imageExists(imageName: string): Promise<boolean>
}
```

### Process Integration (`src/process.ts`)

Extends CCProcess with Docker support:
- `executeInDocker()`: Runs commands in Docker containers
- `streamInDocker()`: Streams output from Docker
- Maintains all existing functionality

### SDK Functions (`src/functions.ts`)

Docker options integrated seamlessly:
```typescript
interface ClaudeOptions {
  // ... existing options
  docker?: boolean | DockerOptions;
}
```

### Type System (`src/types.ts`)

Well-typed Docker configuration:
```typescript
interface DockerOptions {
  auto?: boolean;              // Auto-detect setup
  image?: string;              // Docker image name
  dockerfile?: string;         // Path to Dockerfile
  mounts?: string[];          // Additional volume mounts
  env?: Record<string, string>; // Environment variables
}
```

## Execution Flow

### 1. Configuration Resolution
```
User Options → DockerManager → ResolvedDockerConfig
```

### 2. Command Construction
```
Claude Args + Docker Args → Full Docker Command
```

### 3. Execution Modes

#### Standard Execution
```bash
docker run --rm -i -v $PWD:/workspace:rw my-claude claude --prompt "..."
```

#### Interactive Mode
```bash
exec echo 'prompt' | exec docker run -it ... claude
```

#### Streaming Mode
- Same streaming interface
- Docker stdout → Stream parser → User

## Composability Examples

### With Sessions
```typescript
const s = session();
await s.claude('Task 1', { docker: { image: 'claude-dev' } });
await s.claude('Task 2'); // Continues in same Docker config
```

### With Streaming
```typescript
for await (const chunk of stream('Generate code', {
  docker: true,
  parse: true
})) {
  process.stdout.write(chunk.content);
}
```

### With Dry Run
```typescript
const result = await claude('Task', {
  docker: true,
  dryRun: true
});
console.log(result.data.fullCommand);
// Output: echo -e "Task" | docker run --rm -i ...
```

## Security Model

### Isolation Levels

1. **File System**: Only explicitly mounted directories
2. **Network**: Docker's default network isolation
3. **Process**: Container process isolation
4. **Resources**: Docker resource limits apply

### Authentication

Docker containers need their own authentication setup. Options include:

1. Pre-authenticated images
2. Environment variables passed via `env` option
3. Custom authentication mechanisms within the container

### Claude State Management

> **FOR REVIEW**: This section proposes how to handle Claude's internal state (`~/.claude/projects`) when using Docker. Please review the isolation strategies and default behaviors.

Claude stores its internal project state in `~/.claude/projects`, which contains:
- Project memory and context
- Session data
- Project metadata

#### State Isolation Strategies

1. **None (Default)** - Share global Claude state
   ```typescript
   await claude('Task', { docker: true });
   // Mounts: ~/.claude → /home/claude/.claude
   ```

2. **Project** - Isolate at project level
   ```typescript
   await claude('Task', {
     docker: true,
     state: { stateIsolation: 'project' }
   });
   // Mounts: ./.channelcoder/.claude-state → /home/claude/.claude
   ```

3. **Worktree** - Isolate per git worktree
   ```typescript
   await claude('Task', {
     worktree: 'feature/auth',
     docker: true,
     state: { stateIsolation: 'worktree' }
   });
   // Mounts: ../worktree-path/.claude-state → /home/claude/.claude
   ```

4. **Ephemeral** - Temporary state, destroyed after execution
   ```typescript
   await claude('Experiment', {
     docker: true,
     state: { 
       stateIsolation: 'ephemeral',
       copyStateFrom: 'global'  // Optional: start with existing state
     }
   });
   ```

> **REVIEW QUESTION**: Should we default to 'none' (share global state) or 'project' (isolate by default)? Global sharing is simpler but project isolation might be safer.

#### Implementation Details

```typescript
interface ClaudeStateOptions {
  // State isolation strategy
  stateIsolation?: 'none' | 'project' | 'worktree' | 'ephemeral';
  
  // Copy state from another context
  copyStateFrom?: 'global' | 'project' | string;
  
  // Sync state back after execution (for ephemeral)
  syncBack?: boolean;
}

// Extended DockerOptions
interface DockerOptions {
  // ... existing options
  state?: ClaudeStateOptions;
}
```

#### State Mount Resolution

```typescript
private getClaudeStateMount(options: ClaudeOptions): Mount {
  const stateOpts = options.docker?.state || options.state;
  
  switch (stateOpts?.stateIsolation) {
    case 'project':
      return {
        host: path.join(process.cwd(), '.channelcoder/.claude-state'),
        container: '/home/claude/.claude',
        mode: 'rw'
      };
      
    case 'worktree':
      const worktreePath = this.getWorktreePath(options.worktree);
      return {
        host: path.join(worktreePath, '.claude-state'),
        container: '/home/claude/.claude',
        mode: 'rw'
      };
      
    case 'ephemeral':
      const tempPath = this.createTempClaudeState(stateOpts.copyStateFrom);
      return {
        host: tempPath,
        container: '/home/claude/.claude',
        mode: 'rw',
        cleanup: true  // Remove after execution
      };
      
    case 'none':
    default:
      return {
        host: path.join(homedir(), '.claude'),
        container: '/home/claude/.claude',
        mode: 'rw'
      };
  }
}
```

> **REVIEW NOTE**: The ephemeral state creates a temporary directory that's cleaned up after execution. This is useful for experiments but needs careful handling of the cleanup process.

#### Smart Project Detection

> **FOR REVIEW**: This auto-detection might be too magical. Should we make it explicit?

```typescript
private async detectAndMountProject(options: ClaudeOptions): Promise<Mount | null> {
  if (options.state?.stateIsolation !== 'none') return null;
  
  // Check if current directory is associated with a Claude project
  const projectsDir = path.join(homedir(), '.claude/projects');
  const projects = await fs.readdir(projectsDir);
  
  for (const projectId of projects) {
    const metadataPath = path.join(projectsDir, projectId, 'metadata.json');
    if (await fs.exists(metadataPath)) {
      const metadata = await fs.readJson(metadataPath);
      if (metadata.workingDirectory === process.cwd()) {
        // Mount only this specific project
        return {
          host: path.join(projectsDir, projectId),
          container: path.join('/home/claude/.claude/projects', projectId),
          mode: 'rw'
        };
      }
    }
  }
  
  return null;
}
```

#### Recommended Usage Patterns

```typescript
// Feature development - isolated state per branch
await worktree('feature/payments', async (wt) => {
  await claude('Implement payment system', {
    state: { 
      stateIsolation: 'worktree',
      copyStateFrom: 'global'  // Inherit context from main
    }
  });
});

// Risky experiments - ephemeral state
await claude('Try dangerous refactor', {
  docker: true,
  state: { stateIsolation: 'ephemeral' }
});

// Production work - shared global state
await claude('Fix production bug', {
  docker: true
  // Default: shares ~/.claude state
});
```

> **REVIEW QUESTION**: Should we add state management utilities (list, copy, export) as part of the SDK, or keep it focused on Docker execution only?

#### State Management Utilities

```typescript
export const claudeState = {
  // List all Claude projects
  async listProjects(statePath?: string): Promise<ProjectInfo[]>,
  
  // Copy state between locations
  async copy(from: string, to: string): Promise<void>,
  
  // Export/import for backup and sharing
  async export(projectId: string, outputPath: string): Promise<void>,
  async import(archivePath: string, statePath?: string): Promise<void>
};
```

> **FOR REVIEW**: These utilities would help with state management but might be out of scope for the Docker feature. Should they be a separate module?

## Implementation Details

### Auto-detection Logic

1. Check for manual image → Use directly
2. Check for Dockerfile → Build and cache
3. Error if no configuration found

### Image Naming

Generated from:
- Project directory name
- Dockerfile name
- Simple hash for uniqueness

Example: `channelcoder-myproject-dockerfile-a1b2c3`

### Volume Mounts

Always included:
- Working directory: `$PWD:/workspace:rw`

User-specified mounts are added via the `mounts` option.

### Error Handling

- Docker availability checked before execution
- Build errors surfaced to user
- Process errors maintain same format as non-Docker

## Future Extensibility

The architecture supports future enhancements without breaking changes:

- Docker Compose support via `compose` option
- DevContainer.json integration
- Container reuse for performance
- Network configuration options
- GPU support for future Claude features

## Testing Strategy

### Unit Tests
- Configuration resolution
- Argument construction
- Auth handling

### Integration Tests
- Docker detection
- Image building
- Full execution flow

### E2E Tests
- Session continuity
- Streaming functionality
- Error scenarios

## Conclusion

The Docker integration maintains ChannelCoder's core philosophy: simple, composable, and Unix-like. It adds powerful isolation capabilities without compromising the SDK's ease of use or flexibility. Users can adopt Docker mode incrementally, using it only where needed while maintaining the same familiar API.