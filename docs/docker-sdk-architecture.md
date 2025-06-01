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