# Docker Mode Research Plan for ChannelCoder

## Project Understanding

ChannelCoder is a streamlined SDK/CLI wrapper for Claude Code that:
- Uses Node.js `spawn` to execute the `claude` CLI command
- Focuses on simplicity, functional design, and CLI-mirroring behavior
- Provides template interpolation and file-based prompts
- Offers multiple execution modes (run, stream, interactive)
- Maintains Node.js/Bun compatibility

## Docker Mode Vision

Create a "docker mode" that allows running Claude CLI in an isolated Docker container with the dangerous `--dangerously-skip-permissions` flag, providing safe execution of potentially risky operations while maintaining the SDK's philosophy of simplicity.

## Research Tasks

### 1. Docker Integration Approaches

#### A. Container Management Options
- **Docker CLI Wrapping**: Use Node.js to spawn `docker run` commands
- **Docker SDK**: Use dockerode or similar Node.js Docker client
- **Docker Compose**: For more complex setups
- **Testcontainers**: For dynamic container management

#### B. Key Research Questions
- How to maintain streaming support through Docker?
- How to handle stdin/stdout/stderr piping through Docker?
- How to manage container lifecycle (create, start, stop, cleanup)?
- How to handle file mounting for workspace access?
- How to preserve session state across container restarts?

### 2. Claude CLI in Docker

#### A. Container Requirements
- Base image with Claude CLI pre-installed
- Environment setup for Claude authentication
- Volume mounting for workspace access
- Network configuration for MCP servers

#### B. Research Items
- Claude CLI installation in container
- Authentication token passing (env vars vs mounted files)
- File system permissions and user mapping
- Container resource limits
- Signal handling (SIGTERM, SIGINT)

### 3. API Design Considerations

#### A. SDK Integration Patterns
```typescript
// Option 1: Mode parameter
await claude('Dangerous task', { 
  mode: 'docker',
  dockerOptions: { ... }
});

// Option 2: Dedicated function
await docker.claude('Dangerous task', {
  tools: ['*'],  // All tools allowed
  mount: './workspace:/workspace'
});

// Option 3: Session-based
const s = dockerSession({
  image: 'channelcoder/claude:latest',
  permissions: 'all'
});
await s.claude('Do dangerous things');
```

#### B. Configuration Options
- Docker image selection
- Volume mounting configuration
- Environment variable passing
- Resource limits (CPU, memory)
- Network mode
- Container reuse vs fresh containers

### 4. Safety & Security

#### A. Container Isolation
- User namespace mapping
- Read-only mounts where possible
- Network isolation options
- Resource quotas

#### B. Permission Model
- How to safely pass `--dangerously-skip-permissions` to Claude
- Audit logging of dangerous operations
- Confirmation prompts for risky actions
- Sandbox escape prevention

### 5. Performance Considerations

#### A. Container Overhead
- Startup time impact
- Memory usage
- Disk space for images
- Network latency

#### B. Optimization Strategies
- Container reuse/pooling
- Pre-warmed containers
- Layer caching
- Minimal base images

### 6. Implementation Strategy

#### A. Phased Approach
1. **Phase 1**: Basic Docker wrapping
   - Simple `docker run` spawning
   - Basic stdin/stdout handling
   - Proof of concept

2. **Phase 2**: Enhanced Features
   - Streaming support
   - Session preservation
   - Volume management

3. **Phase 3**: Production Ready
   - Container lifecycle management
   - Error handling and recovery
   - Performance optimizations

#### B. Least Intrusive Integration
- New module: `src/docker.ts`
- Extend `CCProcess` class or create `DockerCCProcess`
- Minimal changes to existing APIs
- Optional dependency (Docker not required for normal use)

### 7. Technical Spike Areas

#### A. Streaming Through Docker
```bash
# Test streaming with docker run
echo "prompt" | docker run -i claude --output-format stream-json
```

#### B. Signal Handling
```javascript
// How to forward signals to container
process.on('SIGINT', () => {
  dockerContainer.kill('SIGINT');
});
```

#### C. File System Integration
```javascript
// Dynamic volume mounting
const mounts = [
  `${process.cwd()}:/workspace:ro`,
  `${sessionDir}:/sessions:rw`
];
```

### 8. Dockerfile Design

```dockerfile
# channelcoder/claude:latest
FROM node:20-slim

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m claude

# Setup workspace
WORKDIR /workspace

# Entry point
USER claude
ENTRYPOINT ["claude"]
```

### 9. Testing Strategy

#### A. Integration Tests
- Container startup/shutdown
- Command execution
- Streaming functionality
- Error scenarios

#### B. Performance Tests
- Startup time benchmarks
- Memory usage profiling
- Concurrent container handling

### 10. Documentation Needs

#### A. User Documentation
- Docker mode setup guide
- Security best practices
- Performance tuning
- Troubleshooting

#### B. Developer Documentation
- Architecture decisions
- Extension points
- Container lifecycle
- Error handling patterns

## Research Questions to Answer

1. **Compatibility**: Will Docker mode work on all platforms (Windows, macOS, Linux)?
2. **Dependencies**: Should Docker be an optional peer dependency?
3. **Defaults**: What should be the default container configuration?
4. **Licensing**: Any licensing implications of bundling Claude in Docker image?
5. **Distribution**: Should we publish official Docker images?

## Success Criteria

1. **Simplicity**: Docker mode is as easy to use as regular mode
2. **Performance**: Acceptable overhead (<2s startup time)
3. **Safety**: True isolation with no escape vectors
4. **Compatibility**: Works with all existing features
5. **Maintainability**: Minimal code complexity increase

## Next Steps

1. Create proof-of-concept Docker wrapper
2. Test streaming and interactive modes
3. Benchmark performance impact
4. Design final API based on findings
5. Implement production version
6. Create comprehensive tests
7. Document usage and best practices

## Timeline Estimate

- Research & Prototyping: 2-3 days
- Implementation: 3-4 days
- Testing & Documentation: 2-3 days
- Total: ~1.5-2 weeks

## Risk Assessment

- **High**: Docker not installed/available
- **Medium**: Performance overhead unacceptable
- **Medium**: Streaming complexity through Docker
- **Low**: API design conflicts
- **Low**: Security vulnerabilities

## Alternative Approaches

If Docker mode proves too complex:
1. **VM-based isolation**: Use lightweight VMs
2. **Sandbox tools**: Use firejail or similar
3. **Process isolation**: Use OS-level sandboxing
4. **Warning mode**: Just warn about dangerous operations