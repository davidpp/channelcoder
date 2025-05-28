# Docker Mode Implementation Plan

## Public API Additions

### 1. DockerOptions Interface
```typescript
interface DockerOptions {
  // Auto-detection (default: true)
  auto?: boolean;
  
  // Manual image specification
  image?: string;
  
  // Build from Dockerfile (default: ./Dockerfile if exists)
  dockerfile?: string;
  
  // Authentication options
  auth?: {
    mountHostAuth?: boolean;    // Default: true
    customAuthPath?: string;    // Override ~/.claude.json location
  };
  
  // Volume mounts (in addition to auto-mounts)
  mounts?: string[];
  
  // Environment variables
  env?: Record<string, string>;
}
```

### 2. ClaudeOptions Extension
```typescript
interface ClaudeOptions {
  // ... existing options
  docker?: boolean | DockerOptions;  // New option
}
```

### 3. Usage Examples
```typescript
// Simplest - auto-detect everything
await claude('Task', { docker: true });

// Specify image
await claude('Task', { docker: { image: 'my-claude' } });

// Build from Dockerfile
await claude('Task', { docker: { dockerfile: './Dockerfile.dev' } });

// Full control
await claude('Task', {
  docker: {
    image: 'claude-sandbox',
    auth: { mountHostAuth: true },
    mounts: ['./data:/data:ro'],
    env: { NODE_ENV: 'test' }
  }
});
```

## Implementation Architecture

### 1. New Module: src/docker.ts
Handles Docker-specific logic:
- Docker detection and validation
- Auth file discovery and mounting
- Dockerfile detection and building
- Docker args construction

### 2. Extended: src/process.ts
Adds Docker execution path:
- Check if Docker mode requested
- Delegate to docker.ts for setup
- Execute via Docker instead of direct Claude

### 3. Updated: src/types.ts
Add DockerOptions interface

### 4. Updated: src/functions.ts
Pass Docker options through to CCProcess

## File Structure

```
src/
  docker.ts        # New: Docker handling logic
  process.ts       # Modified: Add Docker execution
  types.ts         # Modified: Add DockerOptions
  functions.ts     # Modified: Pass Docker options
test/
  docker.test.ts   # New: Docker mode tests
```

## Implementation Steps

### Phase 1: Core Types and Structure
1. Add DockerOptions to types.ts
2. Create docker.ts with basic structure
3. Add docker detection logic

### Phase 2: Docker Execution
1. Extend CCProcess with Docker support
2. Implement auth mounting
3. Handle all execution modes

### Phase 3: Auto-detection
1. Detect Dockerfile in project
2. Auto-build if needed
3. Cache built images

### Phase 4: Testing and Documentation
1. Add comprehensive tests
2. Update README
3. Add examples

## Key Implementation Details

### Docker Module Structure
```typescript
// src/docker.ts
export class DockerManager {
  async detectDocker(): Promise<boolean>
  async resolveDockerConfig(options: DockerOptions): Promise<ResolvedDockerConfig>
  buildDockerArgs(config: ResolvedDockerConfig, claudeArgs: string[]): string[]
  getAuthMounts(options: DockerOptions): string[]
}
```

### Process Integration
```typescript
// In CCProcess.execute()
if (options.docker) {
  const dockerManager = new DockerManager();
  const dockerConfig = await dockerManager.resolveDockerConfig(options.docker);
  return this.executeInDocker(prompt, options, dockerConfig);
}
```

### Error Handling
- Check if Docker is installed
- Validate image exists or can be built
- Handle missing auth gracefully
- Provide helpful error messages

## Testing Strategy

1. Unit tests for docker.ts
2. Integration tests with mock Docker
3. E2E test with real Docker (optional)
4. Test all execution modes
5. Test auth mounting scenarios

## Documentation Updates

1. README.md - Add Docker mode section
2. Examples - Add Docker examples
3. CLAUDE.md - Note Docker compatibility
4. Inline JSDoc comments

## Success Criteria

1. `docker: true` works out of the box
2. All execution modes work identically
3. Auth is handled transparently
4. Clear error messages
5. No breaking changes to existing API