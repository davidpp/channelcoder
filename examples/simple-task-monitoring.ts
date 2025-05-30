#!/usr/bin/env node
/**
 * Simple task monitoring example
 * Shows the essential pattern for detached sessions with monitoring
 */

import { session } from 'channelcoder';
import { spawn } from 'child_process';

async function main() {
  const taskId = '06_clean-up-ui-com-aft-api-05H';
  
  // 1. Create a named session for the task
  const s = session({ 
    name: `task-${taskId}`,
    autoSave: true  // Real-time updates to session file
  });
  
  // 2. Start task in detached mode
  console.log(`Starting task ${taskId} in background...`);
  
  const result = await s.detached(`
    TEST MODE: This is a quick test of the detached session feature.
    Simply calculate 2+2 and then stop, saying you need feedback to continue.
  `, {
    logFile: `${taskId}.log`,
    stream: true,
    outputFormat: 'stream-json'
  });
  
  if (!result.success) {
    console.error('Failed:', result.error);
    return;
  }
  
  // 3. Show monitoring commands
  console.log(`
✅ Task started!

Monitor in separate terminals:
1. Output:  tail -f ${taskId}.log | jq -r '.content // .error // .'
2. Session: watch -n 1 cat ~/.channelcoder/sessions/task-${taskId}.json

When Claude stops for feedback:
  node simple-task-monitoring.ts continue
`);
}

// Continue a paused task
async function continueTask() {
  const taskId = '06_clean-up-ui-com-aft-api-05H';
  
  // Load existing session
  const s = await session.load(`task-${taskId}`);
  
  // Check last message
  const messages = s.messages();
  if (messages.length > 0) {
    console.log('\nLast message:', messages[messages.length - 1].content.slice(0, 200) + '...\n');
  }
  
  // Continue with feedback
  const result = await s.detached(`
    TEST MODE CONTINUE: Thanks for the feedback. Now just say "Test complete!"
  `, {
    logFile: `${taskId}-continue.log`,
    stream: true,
    outputFormat: 'stream-json'
  });
  
  if (result.success) {
    console.log('✅ Task resumed!');
    console.log(`Monitor: tail -f ${taskId}-continue.log | jq -r '.content // .'`);
  }
}

// Run based on command
if (process.argv[2] === 'continue') {
  continueTask().catch(console.error);
} else {
  main().catch(console.error);
}