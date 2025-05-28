#!/usr/bin/env bun
/**
 * Mock Claude Docker Integration Test
 * Simulates running Claude CLI in Docker with proper I/O handling
 */

import { spawn } from 'child_process';
import { homedir } from 'os';
import { existsSync } from 'fs';
import path from 'path';

interface DockerClaudeOptions {
  image: string;
  prompt: string;
  outputFormat?: 'json' | 'stream-json' | 'text';
  mountAuth?: boolean;
  workDir?: string;
}

class DockerClaudePrototype {
  async execute(options: DockerClaudeOptions) {
    const authFile = path.join(homedir(), '.claude.json');
    const hasAuth = existsSync(authFile);
    const workDir = options.workDir || process.cwd();
    
    console.log('\n🐳 Docker Claude Execution');
    console.log('─'.repeat(40));
    console.log(`Image: ${options.image}`);
    console.log(`Auth mounted: ${options.mountAuth && hasAuth ? 'Yes' : 'No'}`);
    console.log(`Output format: ${options.outputFormat || 'json'}`);
    console.log(`Working dir: ${workDir}`);
    console.log('─'.repeat(40));
    
    // Build docker args
    const dockerArgs = [
      'run', '--rm', '-i',
      // Mount auth if requested and exists
      ...(options.mountAuth && hasAuth ? [
        '-v', `${authFile}:/home/node/.claude.json:ro`
      ] : []),
      // Mount working directory
      '-v', `${workDir}:/workspace:rw`,
      '-w', '/workspace',
      // Environment
      '-e', 'TERM=xterm-256color',
      // Image
      options.image,
      // Mock Claude command (using node to simulate)
      'node', '-e', this.getMockClaudeScript(options.outputFormat || 'json')
    ];
    
    return this.runDocker(dockerArgs, options.prompt);
  }
  
  async stream(options: DockerClaudeOptions) {
    const streamOptions = { ...options, outputFormat: 'stream-json' as const };
    return this.execute(streamOptions);
  }
  
  private async runDocker(args: string[], prompt: string) {
    const proc = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Send prompt
    proc.stdin.write(prompt);
    proc.stdin.end();
    
    // Handle output
    const result = {
      stdout: '',
      stderr: '',
      chunks: [] as string[],
      exitCode: -1
    };
    
    // For streaming, process line by line
    let buffer = '';
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      result.stdout += text;
      
      if (args.includes('stream-json')) {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            result.chunks.push(line);
            // Parse and display streaming content
            try {
              const data = JSON.parse(line);
              if (data.type === 'content' && data.text) {
                process.stdout.write(data.text);
              } else if (data.type === 'system') {
                console.log(`\n[SESSION] ${data.session_id}`);
              } else if (data.type === 'result') {
                console.log(`\n[COMPLETE]`);
              }
            } catch {
              console.log(`[STREAM] ${line}`);
            }
          }
        }
      } else {
        console.log(`[OUTPUT] ${text.trim()}`);
      }
    });
    
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      result.stderr += text;
      console.error(`[STDERR] ${text.trim()}`);
    });
    
    // Wait for completion
    result.exitCode = await new Promise<number>((resolve) => {
      proc.on('exit', (code) => resolve(code || 0));
    });
    
    return result;
  }
  
  private getMockClaudeScript(format: string): string {
    // Mock different Claude output formats
    const scripts = {
      json: `
        let prompt = '';
        process.stdin.on('data', d => prompt += d);
        process.stdin.on('end', () => {
          console.log(JSON.stringify({
            type: 'result',
            result: 'TypeScript is a typed superset of JavaScript.',
            session_id: 'mock-session-123'
          }));
        });
      `,
      'stream-json': `
        let prompt = '';
        process.stdin.on('data', d => prompt += d);
        process.stdin.on('end', () => {
          // Simulate streaming response
          const messages = [
            {type: 'system', session_id: 'mock-session-456'},
            {type: 'content', text: 'TypeScript is'},
            {type: 'content', text: ' a typed'},
            {type: 'content', text: ' superset of JavaScript.'},
            {type: 'result', result: 'Complete response here'}
          ];
          
          messages.forEach((msg, i) => {
            setTimeout(() => {
              console.log(JSON.stringify(msg));
            }, i * 100);
          });
        });
      `,
      text: `
        let prompt = '';
        process.stdin.on('data', d => prompt += d);
        process.stdin.on('end', () => {
          console.log('TypeScript is a typed superset of JavaScript.');
          console.error('Session ID: mock-session-789');
        });
      `
    };
    
    return scripts[format] || scripts.json;
  }
}

// Run tests
async function runTests() {
  const docker = new DockerClaudePrototype();
  
  console.log('🧪 Claude Docker Integration Tests\n');
  
  // Test 1: JSON output
  console.log('Test 1: JSON Output');
  const result1 = await docker.execute({
    image: 'node:20-slim',
    prompt: 'What is TypeScript?',
    outputFormat: 'json',
    mountAuth: true
  });
  console.log(`Exit code: ${result1.exitCode}`);
  console.log();
  
  // Test 2: Streaming output
  console.log('Test 2: Streaming Output');
  const result2 = await docker.stream({
    image: 'node:20-slim',
    prompt: 'Explain JavaScript',
    mountAuth: true
  });
  console.log(`Exit code: ${result2.exitCode}`);
  console.log(`Chunks received: ${result2.chunks.length}`);
  console.log();
  
  // Test 3: Text output with session extraction
  console.log('Test 3: Text Output');
  const result3 = await docker.execute({
    image: 'node:20-slim',
    prompt: 'Hello Claude',
    outputFormat: 'text',
    mountAuth: false
  });
  console.log(`Exit code: ${result3.exitCode}`);
  
  // Extract session ID from stderr
  const sessionMatch = result3.stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);
  if (sessionMatch) {
    console.log(`Extracted session ID: ${sessionMatch[1]}`);
  }
  
  console.log('\n✅ All tests completed');
}

runTests().catch(console.error);