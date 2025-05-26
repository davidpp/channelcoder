#!/usr/bin/env bun

import { execSync } from 'child_process';
import { interactive } from '../src/index.js';

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.error('❌ Usage: bun run implement <task-id>');
  console.error('Example: bun run implement FEAT-ADDSESSION-0524-Y5');
  process.exit(1);
}

console.log(`🚀 Starting implementation for task: ${taskId}\n`);

try {
  // Get task details using sc
  console.log('📋 Fetching task details...');
  const taskContent = execSync(`sc get "${taskId}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr too
  }).trim();

  if (!taskContent || taskContent.includes('not found')) {
    console.error(`❌ Task ${taskId} not found`);
    process.exit(1);
  }

  console.log('🤖 Launching Claude with implementation prompt...\n');

  // Use the new SDK with interactive mode
  const result = await interactive('prompts/implement.md', {
    data: { taskContent },
  });

  console.log('Result:', result);

  if (result.exitCode !== 0) {
    process.exit(result.exitCode || 1);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error('❌ Error:', error.message);
  } else {
    console.error('❌ Error:', error);
  }

  // Check for specific error types
  const err = error as { code?: string; status?: number };
  if (err.code === 'ENOENT') {
    console.error('💡 Make sure "sc" (Scopecraft) is installed and in PATH');
  }

  // Exit with appropriate code
  process.exit(err.status || 1);
}
