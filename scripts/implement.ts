#!/usr/bin/env bun

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.error('❌ Usage: bun run implement <task-id>');
  console.error('Example: bun run implement FEAT-ADDSESSION-0524-Y5');
  process.exit(1);
}

// Check if prompt file exists
const promptPath = join(process.cwd(), 'prompts/implement.md');
if (!existsSync(promptPath)) {
  console.error('❌ Prompt file not found at prompts/implement.md');
  process.exit(1);
}

console.log(`🚀 Starting implementation for task: ${taskId}\n`);

try {
  // Get task details using sc
  console.log('📋 Fetching task details...');
  const taskContent = execSync(`sc get "${taskId}"`, { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr too
  }).trim();
  
  if (!taskContent || taskContent.includes('not found')) {
    console.error(`❌ Task ${taskId} not found`);
    process.exit(1);
  }

  // Escape the content for JSON
  const escapedContent = JSON.stringify(taskContent);
  
  // Build the cc command
  const dataJson = JSON.stringify({ taskContent });
  
  console.log('🤖 Launching Claude with implementation prompt...\n');
  
  // Execute cc with the prompt using our local development version
  execSync(`bun run cli prompts/implement.md --data '${dataJson}'`, {
    stdio: 'inherit' // Pass through all I/O
  });
  
} catch (error: any) {
  if (error.code === 'ENOENT') {
    console.error('❌ Make sure "sc" (Scopecraft) is installed and in PATH');
  } else if (error.status === 127) {
    console.error('❌ Command not found. Make sure "sc" is available');
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}