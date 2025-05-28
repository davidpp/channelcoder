# Docker Mode - Developer-Friendly API Design

## Philosophy
Leverage existing Docker setups developers already have, making it zero-config when possible.

## API Design

### Auto-Detection Approach

```typescript
interface DockerOptions {
  // Auto-detect mode (default)
  auto?: boolean;                    // Default: true - auto-detect Docker setup
  
  // Manual overrides
  image?: string;                    // Override detected image
  dockerfile?: string;               // Path to Dockerfile (default: ./Dockerfile)
  compose?: string | boolean;        // Use docker-compose (true = auto-detect)
  devcontainer?: boolean;            // Use devcontainer.json setup
  
  // Common options
  mounts?: string[];                 // Additional mounts
  env?: Record<string, string>;      // Additional env vars
  buildArgs?: Record<string, string>;// Docker build args
}

interface ClaudeOptions {
  // ... existing options
  docker?: boolean | DockerOptions;  // true = auto-detect everything
}
```

### Usage Examples

```typescript
// Simplest - auto-detect everything
await claude('Analyze codebase', { docker: true });

// Use project's Dockerfile
await claude('Run tests', { 
  docker: { 
    dockerfile: './Dockerfile.dev' 
  } 
});

// Use existing docker-compose service
await claude('Debug issue', { 
  docker: { 
    compose: 'app'  // Use 'app' service from docker-compose.yml
  } 
});

// Use devcontainer setup
await claude('Format code', { 
  docker: { 
    devcontainer: true 
  } 
});

// Manual image (current approach still works)
await claude('Deploy', { 
  docker: { 
    image: 'my-claude:latest' 
  } 
});
```

## Auto-Detection Logic

```typescript
async function resolveDockerConfig(options: DockerOptions): Promise<ResolvedDocker> {
  // If manual image specified, use it
  if (options.image) {
    return { mode: 'image', image: options.image };
  }
  
  // Check for devcontainer.json
  if (options.devcontainer !== false) {
    const devcontainer = await findDevContainer();
    if (devcontainer) {
      return { 
        mode: 'devcontainer', 
        config: devcontainer,
        // Use devcontainer CLI or extract image
      };
    }
  }
  
  // Check for docker-compose.yml
  if (options.compose !== false) {
    const composeFile = await findDockerCompose();
    if (composeFile) {
      const service = typeof options.compose === 'string' 
        ? options.compose 
        : await detectMainService(composeFile);
      return { 
        mode: 'compose', 
        file: composeFile,
        service 
      };
    }
  }
  
  // Check for Dockerfile
  const dockerfile = options.dockerfile || './Dockerfile';
  if (await fileExists(dockerfile)) {
    // Build image on-the-fly with caching
    const imageName = `channelcoder-${projectHash}:latest`;
    await buildDockerImage(dockerfile, imageName, options.buildArgs);
    return { mode: 'dockerfile', image: imageName };
  }
  
  throw new Error('No Docker configuration found. Create a Dockerfile or specify an image.');
}
```

## Detection Helpers

```typescript
// Find devcontainer.json
async function findDevContainer(): Promise<DevContainerConfig | null> {
  const paths = [
    '.devcontainer/devcontainer.json',
    '.devcontainer.json',
    'devcontainer.json'
  ];
  
  for (const path of paths) {
    if (await fileExists(path)) {
      return JSON.parse(await readFile(path));
    }
  }
  return null;
}

// Find docker-compose.yml
async function findDockerCompose(): Promise<string | null> {
  const paths = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml'
  ];
  
  for (const path of paths) {
    if (await fileExists(path)) {
      return path;
    }
  }
  return null;
}
```

## Execution Modes

### 1. Dockerfile Mode
```bash
# Auto-build if needed (with caching)
docker build -t channelcoder-abc123 .

# Run command
docker run --rm -i channelcoder-abc123 claude --print "prompt"
```

### 2. Docker Compose Mode
```bash
# Use existing service
docker compose run --rm app claude --print "prompt"
```

### 3. DevContainer Mode
```bash
# Use devcontainer CLI (if available)
devcontainer exec --workspace-folder . claude --print "prompt"

# OR extract image from devcontainer.json
docker run --rm -i mcr.microsoft.com/devcontainers/javascript-node claude --print "prompt"
```

## Smart Defaults

1. **Automatic Claude Installation**: If Dockerfile doesn't have claude, inject it:
   ```typescript
   // Detect if claude is in image
   const hasClause = await checkImageHasClaude(image);
   if (!hasClause) {
     // Create temporary Dockerfile that extends user's image
     const tempDockerfile = `
       FROM ${image}
       RUN npm install -g @anthropic-ai/claude-code
     `;
   }
   ```

2. **Working Directory**: Mount current directory automatically:
   ```typescript
   const defaultMounts = [
     `${process.cwd()}:/workspace:rw`
   ];
   ```

3. **Environment**: Pass through ANTHROPIC_API_KEY automatically:
   ```typescript
   const defaultEnv = {
     ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
   };
   ```

## Progressive Enhancement

```typescript
// Level 1: Just works
await claude('Fix bugs', { docker: true });

// Level 2: Choose strategy
await claude('Fix bugs', { docker: { compose: true } });

// Level 3: Full control
await claude('Fix bugs', { 
  docker: {
    image: 'custom:latest',
    mounts: ['./data:/data:ro'],
    env: { NODE_ENV: 'test' }
  }
});
```

## Benefits

1. **Zero Config**: Works with existing Docker setups
2. **Flexible**: From simple to advanced use cases
3. **Developer-Friendly**: Leverages familiar tools
4. **Smart**: Auto-detects the best approach
5. **Composable**: All options work together

This approach makes Docker mode feel native to the developer's existing workflow rather than imposing a new one.