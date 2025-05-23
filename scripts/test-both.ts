#!/usr/bin/env bun

/**
 * Run tests in both Bun and Node.js environments
 */

import { spawn } from 'child_process';

async function runCommand(command: string, args: string[], env?: Record<string, string>) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on('exit', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

async function main() {
  console.log('🧪 Running tests in both Bun and Node.js environments...\n');

  // Run Bun tests
  console.log('=== Running Bun tests ===');
  const bunResult = await runCommand('bun', ['test', 'test/node-compat.test.ts'], {
    BUN_ENV: 'test',
  });

  if (bunResult.code !== 0) {
    console.error('\n❌ Bun tests failed');
    process.exit(1);
  }

  console.log('\n✅ Bun tests passed\n');

  // Build the project
  console.log('=== Building project ===');
  const buildResult = await runCommand('bun', ['run', 'build']);

  if (buildResult.code !== 0) {
    console.error('\n❌ Build failed');
    process.exit(1);
  }

  // Run Node.js integration tests
  console.log('\n=== Running Node.js integration tests ===');
  const nodeResult = await runCommand('node', ['--test', 'test/node-compat.test.ts'], {
    NODE_ENV: 'test',
  });

  if (nodeResult.code !== 0) {
    console.error('\n❌ Node.js tests failed');
    process.exit(1);
  }

  console.log('\n✅ All tests passed in both environments!');
}

main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
