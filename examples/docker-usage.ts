#!/usr/bin/env bun
/**
 * Docker Mode Examples
 * 
 * Demonstrates running Claude in isolated Docker containers
 * for enhanced security with dangerous operations.
 */

import { claude, stream } from '../src/index.js';

async function main() {
  console.log('🐳 ChannelCoder Docker Mode Examples\n');

  // Example 1: Simple Docker mode with auto-detection
  console.log('1. Auto-detect Dockerfile:');
  console.log('   await claude("List all files", { docker: true })');
  console.log('   This would look for ./Dockerfile and build an image\n');

  // Example 2: Specify Docker image
  console.log('2. Using specific Docker image:');
  try {
    const result = await claude('What tools are available?', {
      docker: { image: 'alpine' }, // This will fail - alpine doesn't have claude
      dryRun: true, // Just show the command
    });
    console.log('   Command:', result.data?.fullCommand);
  } catch (error) {
    console.log('   Note: This would fail as alpine doesn\'t have Claude CLI');
  }
  console.log();

  // Example 3: Docker with full permissions
  console.log('3. Run with all tools in isolated environment:');
  const dangerousCommand = await claude('Show docker command for dangerous operation', {
    docker: {
      image: 'my-claude-sandbox',
      mounts: ['./workspace:/workspace:rw'],
      env: { CLAUDE_ENV: 'sandbox' }
    },
    tools: ['*'], // All tools allowed in container
    dryRun: true,
  });
  console.log('   Full command:', dangerousCommand.data?.fullCommand);
  console.log();

  // Example 4: Docker without auth mounting
  console.log('4. Docker without mounting host auth:');
  const noAuthCommand = await claude('Process without host credentials', {
    docker: {
      image: 'pre-authenticated-claude',
      auth: { mountHostAuth: false }
    },
    dryRun: true,
  });
  console.log('   Command:', noAuthCommand.data?.fullCommand);
  console.log();

  // Example 5: Custom Dockerfile location
  console.log('5. Build from custom Dockerfile:');
  console.log('   await claude("Task", {');
  console.log('     docker: { dockerfile: "./docker/Claude.dockerfile" }');
  console.log('   })');
  console.log();

  // Example 6: Streaming with Docker
  console.log('6. Streaming mode with Docker:');
  console.log('   for await (const chunk of stream("Generate code", {');
  console.log('     docker: { image: "claude-dev" },');
  console.log('     parse: true');
  console.log('   })) {');
  console.log('     process.stdout.write(chunk.content);');
  console.log('   }');
  console.log();

  // Example Dockerfile
  console.log('📄 Example Dockerfile for Claude:');
  console.log('```dockerfile');
  console.log('FROM node:20-slim');
  console.log('');
  console.log('# Install Claude CLI');
  console.log('RUN npm install -g @anthropic-ai/claude-code');
  console.log('');
  console.log('# Install additional tools Claude might need');
  console.log('RUN apt-get update && apt-get install -y \\');
  console.log('    git \\');
  console.log('    python3 \\');
  console.log('    && rm -rf /var/lib/apt/lists/*');
  console.log('');
  console.log('# Create non-root user');
  console.log('RUN useradd -m -s /bin/bash claude');
  console.log('USER claude');
  console.log('');
  console.log('WORKDIR /workspace');
  console.log('```');
  console.log();

  console.log('🔒 Security Benefits:');
  console.log('- Isolated execution environment');
  console.log('- No risk to host system with dangerous tools');
  console.log('- Controlled file system access');
  console.log('- Clean environment for each run');
}

main().catch(console.error);