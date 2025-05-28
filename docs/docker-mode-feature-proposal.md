# Docker Mode Feature Proposal for ChannelCoder

## Executive Summary

Add Docker support to channelcoder to enable running Claude CLI in isolated containers with full permissions (`--permission-all`), while maintaining the SDK's simplicity and Unix philosophy.

## Technical Implementation

### Authentication Discovery

Based on research, Claude Code stores authentication in:
- **Primary**: `~/.claude.json` - Contains OAuth tokens and configuration
- **Alternative**: `~/.config/claude/` directory (platform-dependent)
- **Custom commands**: `~/.claude/commands/` directory

### API Design

```typescript
interface DockerOptions {
  // Auto-detection (default behavior)
  auto?: boolean;                    // Default: true
  
  // Image/build options
  image?: string;                    // Manual image specification
  dockerfile?: string;               // Build from Dockerfile
  compose?: string | boolean;        // Use docker-compose service
  devcontainer?: boolean;            // Use .devcontainer/devcontainer.json
  
  // Authentication
  auth?: {
    mountHostAuth?: boolean;         // Default: true - mount ~/.claude.json
    customAuthPath?: string;         // Override auth file location
  };
  
  // Standard Docker options
  mounts?: string[];                 // Additional volume mounts
  env?: Record<string, string>;      // Environment variables
}

// Simple usage
await claude('Dangerous task', { docker: true });

// Advanced usage
await claude('Complex task', {
  docker: {
    image: 'my-claude-env',
    auth: { mountHostAuth: true },
    mounts: ['./data:/data:ro']
  }
});
```

### Implementation Details

#### 1. Authentication Mounting
```typescript
function getAuthMounts(options: DockerOptions): string[] {
  if (options.auth?.mountHostAuth === false) return [];
  
  const authFile = options.auth?.customAuthPath || path.join(homedir(), '.claude.json');
  const mounts: string[] = [];
  
  // Mount the main auth file
  if (fs.existsSync(authFile)) {
    mounts.push(`${authFile}:/home/claude/.claude.json:ro`);
  }
  
  // Mount commands directory if exists
  const commandsDir = path.join(homedir(), '.claude/commands');
  if (fs.existsSync(commandsDir)) {
    mounts.push(`${commandsDir}:/home/claude/.claude/commands:ro`);
  }
  
  return mounts;
}
```

#### 2. Docker Execution
```typescript
private async executeInDocker(prompt: string, options: CCOptions & { docker: DockerOptions }) {
  const dockerArgs = [
    'run', '--rm', '-i',
    // Add TTY for interactive mode
    ...(options.mode === 'interactive' ? ['-t'] : []),
    // Auth mounts
    ...getAuthMounts(options.docker).flatMap(m => ['-v', m]),
    // User mounts
    ...(options.docker.mounts || []).flatMap(m => ['-v', m]),
    // Working directory mount
    '-v', `${process.cwd()}:/workspace:rw`,
    '-w', '/workspace',
    // Environment
    ...Object.entries(options.docker.env || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    // Image
    options.docker.image,
    // Claude command
    'claude',
    ...await this.buildClaudeArgs(options)
  ];
  
  const proc = spawn('docker', dockerArgs, {
    stdio: options.mode === 'interactive' ? 'inherit' : ['pipe', 'pipe', 'pipe']
  });
  
  // Handle I/O as before...
}
```

### User Dockerfile Requirements

Users need to create their own Docker images with Claude installed:

```dockerfile
# Example user Dockerfile
FROM node:20-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create claude user (optional but recommended)
RUN useradd -m -s /bin/bash claude

# Switch to claude user
USER claude
WORKDIR /workspace

# The auth will be mounted at runtime, no need to bake it in
```

### Documentation for Users

```markdown
## Docker Mode Usage

### Quick Start

1. Create a Dockerfile with Claude Code:
```dockerfile
FROM node:20
RUN npm install -g @anthropic-ai/claude-code
```

2. Build your image:
```bash
docker build -t my-claude .
```

3. Use with channelcoder:
```typescript
await claude('Analyze system', { 
  docker: { image: 'my-claude' } 
});
```

### Authentication

Docker mode automatically mounts your Claude authentication from `~/.claude.json`. 
Make sure you've logged in with `claude` on your host machine first.

### Advanced Setup

For complex environments, include additional tools:
```dockerfile
FROM node:20
RUN apt-get update && apt-get install -y python3 git
RUN npm install -g @anthropic-ai/claude-code
# Add any other tools Claude might need
```
```

## Benefits

1. **Safety**: Run with `--permission-all` in isolated environment
2. **Flexibility**: Users control their container environment
3. **Simplicity**: Just add `docker: true` to enable
4. **Compatibility**: Works with existing Docker workflows
5. **Zero-config**: Auto-detects and uses existing Docker setups

## Implementation Phases

1. **Phase 1**: Basic Docker support with manual image specification
2. **Phase 2**: Auto-detection of Dockerfile/docker-compose
3. **Phase 3**: DevContainer support
4. **Phase 4**: Enhanced auth handling and setup helpers

## Estimated Timeline

- Phase 1: 3-4 hours
- Phase 2: 2-3 hours  
- Phase 3: 2-3 hours
- Phase 4: 2 hours

Total: ~1.5 days of implementation

## Open Questions

1. Should we provide a base Docker image on Docker Hub?
2. How to handle Windows Docker Desktop vs Linux Docker?
3. Should we auto-build images if Dockerfile exists?
4. Support for rootless Docker?

## Conclusion

This Docker mode design maintains channelcoder's philosophy of simplicity while enabling powerful isolated execution. Users bring their own containers, we just make it easy to use them.