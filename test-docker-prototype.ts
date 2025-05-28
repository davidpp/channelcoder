#!/usr/bin/env node
/**
 * Docker Mode Prototype Test
 * 
 * This script tests running Claude Code in a Docker container and capturing output.
 * It's a hardcoded prototype to verify the approach works before full implementation.
 */

import { spawn } from 'child_process';
import { homedir } from 'os';
import { existsSync } from 'fs';
import path from 'path';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDockerClaude() {
  // Configuration (hardcoded for prototype)
  const dockerImage = 'anthropic/claude-code:latest'; // Replace with your built image
  const testPrompt = 'What is TypeScript? Give me a one-line answer.';
  const workDir = process.cwd();
  
  // Check for auth file
  const authFile = path.join(homedir(), '.claude.json');
  const hasAuth = existsSync(authFile);
  
  log('\n=== Docker Claude Prototype Test ===\n', 'blue');
  log(`Working directory: ${workDir}`, 'yellow');
  log(`Auth file found: ${hasAuth ? 'Yes' : 'No'} (${authFile})`, hasAuth ? 'green' : 'red');
  log(`Docker image: ${dockerImage}`, 'yellow');
  log(`Test prompt: "${testPrompt}"`, 'yellow');
  
  // Build Docker command
  const dockerArgs = [
    'run',
    '--rm',           // Remove container after exit
    '-i',             // Interactive (stdin)
    // Mount auth if exists
    ...(hasAuth ? ['-v', `${authFile}:/home/node/.claude.json:ro`] : []),
    // Mount current directory
    '-v', `${workDir}:/workspace:rw`,
    '-w', '/workspace',
    // User and environment
    '--user', 'node',
    '-e', 'TERM=xterm-256color',
    // Image
    dockerImage,
    // Claude command
    'claude',
    '--print',        // Non-interactive mode
    '--output-format', 'json'
  ];
  
  log('\nDocker command:', 'blue');
  log(`docker ${dockerArgs.join(' ')}`, 'yellow');
  
  // Test 1: Basic execution
  log('\n--- Test 1: Basic Execution ---', 'green');
  
  try {
    const proc = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Send prompt to stdin
    proc.stdin.write(testPrompt);
    proc.stdin.end();
    
    // Capture output
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(`[STDOUT] ${chunk}`);
    });
    
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(`[STDERR] ${chunk}`);
    });
    
    // Wait for completion
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('exit', (code) => resolve(code || 0));
    });
    
    log(`\nExit code: ${exitCode}`, exitCode === 0 ? 'green' : 'red');
    
    // Parse JSON output if successful
    if (exitCode === 0 && stdout) {
      try {
        const result = JSON.parse(stdout);
        log('\nParsed result:', 'green');
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        log('\nCould not parse JSON output', 'yellow');
        log('Raw output:', 'yellow');
        console.log(stdout);
      }
    }
    
  } catch (error) {
    log(`\nError: ${error}`, 'red');
  }
  
  // Test 2: Streaming mode
  log('\n--- Test 2: Streaming Mode ---', 'green');
  
  const streamArgs = dockerArgs.filter(arg => arg !== 'json').concat(['stream-json']);
  
  try {
    const proc2 = spawn('docker', streamArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    proc2.stdin.write('Count to 3 slowly');
    proc2.stdin.end();
    
    log('Streaming output:', 'yellow');
    
    // Process streaming JSON
    let buffer = '';
    proc2.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'content' && data.text) {
              process.stdout.write(data.text);
            }
          } catch (e) {
            // Not JSON, print as-is
            console.log(`[RAW] ${line}`);
          }
        }
      }
    });
    
    proc2.stderr.on('data', (chunk) => {
      process.stderr.write(`[STDERR] ${chunk}`);
    });
    
    await new Promise((resolve) => {
      proc2.on('exit', resolve);
    });
    
  } catch (error) {
    log(`\nStreaming error: ${error}`, 'red');
  }
  
  // Test 3: Environment and mounts
  log('\n--- Test 3: File Access Test ---', 'green');
  
  const fileTestArgs = [
    'run',
    '--rm',
    '-i',
    ...(hasAuth ? ['-v', `${authFile}:/home/node/.claude.json:ro`] : []),
    '-v', `${workDir}:/workspace:rw`,
    '-w', '/workspace',
    '--user', 'node',
    dockerImage,
    'claude',
    '--print'
  ];
  
  try {
    const proc3 = spawn('docker', fileTestArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    proc3.stdin.write('List the files in the current directory using bash ls command');
    proc3.stdin.end();
    
    let output = '';
    proc3.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    
    proc3.stderr.on('data', (chunk) => {
      process.stderr.write(`[STDERR] ${chunk}`);
    });
    
    await new Promise((resolve) => {
      proc3.on('exit', resolve);
    });
    
    log('\nFile access test output:', 'yellow');
    console.log(output);
    
  } catch (error) {
    log(`\nFile test error: ${error}`, 'red');
  }
  
  log('\n=== Tests Complete ===\n', 'blue');
}

// Run the test
testDockerClaude().catch(console.error);