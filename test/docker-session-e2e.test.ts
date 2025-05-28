import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { session } from '../src/index.js';
import { FileSessionStorage } from '../src/session-storage.js';
import type { SessionState, SessionStorage } from '../src/session.js';

describe('Docker Session E2E Tests', () => {
  let testDir: string;
  let storage: SessionStorage;

  beforeEach(async () => {
    // Create temp directory for test sessions
    testDir = join(tmpdir(), `channelcoder-docker-session-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new FileSessionStorage(join(testDir, 'sessions'));
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('session workflow with Docker mode (dry-run)', async () => {
    // Create a new session with Docker
    const s = session({ storage });

    // First interaction with Docker - check Docker args are added
    const result1 = await s.claude('What is Docker?', { 
      docker: { image: 'test-claude' },
      dryRun: true 
    });
    
    expect(result1.success).toBe(true);
    expect(result1.data.command).toBe('docker');
    expect(result1.data.args).toContain('run');
    expect(result1.data.args).toContain('test-claude');
    expect(result1.data.args).not.toContain('--resume'); // First interaction

    // Save session
    const savedPath = await s.save('docker-session');
    expect(savedPath).toContain('docker-session.json');

    // Verify file was created
    const savedContent = await fs.readFile(savedPath, 'utf-8');
    const savedState = JSON.parse(savedContent);
    expect(savedState.metadata.name).toBe('docker-session');
  });

  test('continuing session with Docker', async () => {
    // Create a session state with history
    const sessionState: SessionState = {
      sessionChain: ['docker-session-1', 'docker-session-2'],
      currentSessionId: 'docker-session-2',
      messages: [
        {
          role: 'user',
          content: 'Explain containerization',
          timestamp: new Date(),
          sessionId: 'docker-session-1',
        },
        {
          role: 'assistant',
          content: 'Containerization is a lightweight virtualization...',
          timestamp: new Date(),
          sessionId: 'docker-session-1',
        },
      ],
      metadata: {
        name: 'container-learning',
        created: new Date(),
        lastActive: new Date(),
      },
    };

    // Save it
    await storage.save(sessionState, 'container-learning');

    // Load the session
    const s2 = await session.load('container-learning', storage);

    // Continue conversation with Docker
    const result = await s2.claude('How does Docker networking work?', { 
      docker: { image: 'claude-net' },
      dryRun: true 
    });
    
    expect(result.success).toBe(true);
    // Should have both Docker args and session resume
    expect(result.data.command).toBe('docker');
    expect(result.data.args).toContain('claude-net');
    expect(result.data.args).toContain('--resume');
    expect(result.data.args).toContain('docker-session-2');
  });

  test('Docker with authentication options', async () => {
    const s = session({ storage });

    // Test without mounting host auth
    const result1 = await s.claude('Secure task', {
      docker: {
        image: 'secure-claude',
        auth: { mountHostAuth: false }
      },
      dryRun: true
    });

    expect(result1.success).toBe(true);
    const command = result1.data.fullCommand;
    expect(command).toContain('docker run');
    expect(command).not.toContain('.claude.json'); // Should not mount auth

    // Test with custom auth path
    const result2 = await s.claude('Custom auth task', {
      docker: {
        image: 'custom-auth-claude',
        auth: { 
          mountHostAuth: true,
          customAuthPath: '/custom/.claude.json'
        }
      },
      dryRun: true
    });

    expect(result2.success).toBe(true);
    // Note: actual mount would only happen if file exists
  });

  test('Docker with mounts and environment', async () => {
    const s = session({ storage });

    const result = await s.claude('Process data', {
      docker: {
        image: 'data-processor',
        mounts: ['./input:/data/input:ro', './output:/data/output:rw'],
        env: {
          DATA_DIR: '/data',
          PROCESS_MODE: 'batch'
        }
      },
      dryRun: true
    });

    expect(result.success).toBe(true);
    const args = result.data.args;
    
    // Check mounts are included
    expect(args).toContain('-v');
    expect(args).toContain('./input:/data/input:ro');
    expect(args).toContain('./output:/data/output:rw');
    
    // Check environment variables
    expect(args).toContain('-e');
    expect(args).toContain('DATA_DIR=/data');
    expect(args).toContain('PROCESS_MODE=batch');
  });

  test('Docker auto-detection with session', async () => {
    // Create a Dockerfile in test directory
    const dockerfilePath = join(testDir, 'Dockerfile');
    await fs.writeFile(dockerfilePath, `
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
`);

    // Change to test directory for auto-detection
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const s = session({ storage });

      // Use docker: true for auto-detection
      const result = await s.claude('Build something', {
        docker: true,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.command).toBe('docker');
      // Image name would be auto-generated
      expect(result.data.args.some((arg: string) => arg.includes('channelcoder-'))).toBe(true);
    } finally {
      // Restore original directory
      process.chdir(originalCwd);
    }
  });

  test('session with Docker and file-based prompts', async () => {
    // Create a test prompt file
    const promptPath = join(testDir, 'docker-task.md');
    await fs.writeFile(
      promptPath,
      `---
input:
  service: string
---
# Docker Task: {service}

Help me containerize this service.`
    );

    const s = session({ storage });

    // Use file-based prompt with Docker
    const result = await s.claude(promptPath, {
      data: { service: 'web-api' },
      docker: { image: 'claude-devops' },
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.data.prompt).toContain('Docker Task: web-api');
    expect(result.data.prompt).toContain('Help me containerize this service.');
    expect(result.data.command).toBe('docker');
    expect(result.data.args).toContain('claude-devops');
  });

  test('streaming with Docker and sessions', async () => {
    const s = session({ storage });

    // Stream mode with Docker should maintain session context
    const streamResult = s.stream('Stream in Docker', {
      docker: { image: 'claude-stream' }
    });
    
    expect(streamResult[Symbol.asyncIterator]).toBeDefined();

    // With options
    const streamWithOptions = s.stream('Stream with parse', { 
      docker: { image: 'claude-stream' },
      parse: true 
    });
    expect(streamWithOptions[Symbol.asyncIterator]).toBeDefined();
  });

  test('interactive mode with Docker and session', async () => {
    const s = session({ storage });

    // Interactive mode should work with Docker
    // Note: Can't test actual interactive mode in tests
    const result = await s.claude('Interactive Docker task', {
      docker: { image: 'claude-interactive' },
      mode: 'interactive',
      dryRun: true
    });

    expect(result.success).toBe(true);
    // In interactive mode, Docker args should be included
    expect(result.data.fullCommand).toContain('docker');
    expect(result.data.fullCommand).toContain('claude-interactive');
  });

  test('concurrent Docker sessions', async () => {
    // Create two independent sessions using different Docker images
    const devSession = session({ name: 'dev-env', storage });
    const prodSession = session({ name: 'prod-env', storage });

    // Use different Docker configurations
    const devResult = await devSession.claude('Setup dev environment', { 
      docker: { 
        image: 'claude-dev',
        env: { NODE_ENV: 'development' }
      },
      dryRun: true 
    });
    
    const prodResult = await prodSession.claude('Deploy to production', { 
      docker: { 
        image: 'claude-prod',
        env: { NODE_ENV: 'production' }
      },
      dryRun: true 
    });

    expect(devResult.success).toBe(true);
    expect(prodResult.success).toBe(true);

    // They should use different images
    expect(devResult.data.args).toContain('claude-dev');
    expect(prodResult.data.args).toContain('claude-prod');
    
    // And different environments
    expect(devResult.data.args).toContain('NODE_ENV=development');
    expect(prodResult.data.args).toContain('NODE_ENV=production');
  });

  test('error handling with Docker in sessions', async () => {
    const s = session({ storage });

    // Test with missing required options (this would fail without an image in real usage)
    const result = await s.claude('Test error handling', {
      docker: { auto: false }, // Disable auto-detection, no image specified
      dryRun: true
    });

    // In dry-run mode with invalid config, it should fail
    expect(result.success).toBe(false);
    expect(result.error).toContain('No Docker configuration found');
  });
});