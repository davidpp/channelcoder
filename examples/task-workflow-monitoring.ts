#!/usr/bin/env node
/**
 * Task-based workflow with detached sessions and real-time monitoring
 * 
 * This example shows how to:
 * 1. Start a detached session for a specific task
 * 2. Monitor both the session state and output in real-time
 * 3. Resume the session when it needs feedback
 * 4. Continue monitoring after resumption
 */

import { session, detached } from 'channelcoder';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// Task ID from your workflow system
const TASK_ID = '06_clean-up-ui-com-aft-api-05H';
const SESSION_NAME = `task-${TASK_ID}`;

// Helper to start monitoring session file
function startSessionMonitor(sessionPath: string) {
  console.log(`\n📊 Monitoring session at: ${sessionPath}`);
  console.log(`   Run this in another terminal: watch -n 1 cat ${sessionPath}\n`);
  
  // Optionally, spawn a watch process programmatically
  const watch = spawn('watch', ['-n', '1', 'cat', sessionPath], {
    stdio: 'inherit',
    shell: true
  });
  
  return watch;
}

// Helper to monitor detached output
function startOutputMonitor(logFile: string) {
  console.log(`\n📜 Monitoring output at: ${logFile}`);
  console.log(`   Run this in another terminal: tail -f ${logFile} | jq -r '.content // .error // .'`\n`);
  
  // Spawn tail process
  const tail = spawn('tail', ['-f', logFile], {
    stdio: 'pipe',
    shell: true
  });
  
  // Parse JSON chunks and display content
  tail.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line);
        if (chunk.content) {
          process.stdout.write(chunk.content);
        } else if (chunk.error) {
          console.error('\n❌ Error:', chunk.error);
        }
      } catch {
        // Not JSON, just display as-is
        console.log(line);
      }
    }
  });
  
  return tail;
}

// Main workflow
async function runTaskWorkflow() {
  console.log(`🚀 Starting task workflow for: ${TASK_ID}\n`);
  
  // Step 1: Create session for this task
  const s = session({ 
    name: SESSION_NAME,
    autoSave: true  // Enable real-time session updates
  });
  
  // Get session file path for monitoring
  const sessionPath = join(homedir(), '.channelcoder', 'sessions', `${SESSION_NAME}.json`);
  
  // Step 2: Start the task in detached mode
  console.log('📝 Starting task analysis in detached mode...\n');
  
  const logFile = `task-${TASK_ID}.log`;
  
  const result = await s.detached(`
    I need to work on task ${TASK_ID}: Clean up UI components after API integration.
    
    Please analyze the current UI components and identify what needs to be cleaned up.
    Start by examining the components directory and look for:
    1. Unused imports from the old API
    2. Components that can be simplified now that the API is integrated
    3. Any temporary workarounds that can be removed
    
    When you need my feedback on what to prioritize, please stop and ask.
  `, {
    logFile,
    stream: true,  // Enable streaming JSON output
    outputFormat: 'stream-json'
  });
  
  if (!result.success) {
    console.error('Failed to start task:', result.error);
    return;
  }
  
  console.log(`✅ Task started with PID: ${result.pid}`);
  console.log(`📁 Session saved as: ${SESSION_NAME}`);
  console.log(`📄 Output log: ${logFile}\n`);
  
  // Step 3: Start monitoring
  const sessionMonitor = startSessionMonitor(sessionPath);
  const outputMonitor = startOutputMonitor(logFile);
  
  console.log('\n⏳ Waiting for task to complete or request feedback...');
  console.log('   (Press Ctrl+C to stop monitoring)\n');
  
  // Wait for user to press Enter to continue
  await new Promise<void>((resolve) => {
    console.log('\n➡️  Press Enter when Claude requests feedback...');
    process.stdin.once('data', () => resolve());
  });
  
  // Step 4: Load the session to check current state
  console.log('\n🔄 Loading session state...');
  const currentSession = await session.load(SESSION_NAME);
  
  // Display last message to understand context
  const messages = currentSession.messages();
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    console.log('\n📋 Last message from Claude:');
    console.log('─'.repeat(50));
    console.log(lastMessage.content.slice(0, 500) + '...');
    console.log('─'.repeat(50));
  }
  
  // Step 5: Continue the session with feedback
  console.log('\n💬 Continuing session with feedback...\n');
  
  const continueResult = await currentSession.detached(`
    Based on your analysis, I'd like you to prioritize:
    1. First, remove all unused imports and dead code
    2. Then simplify the UserDashboard and ProfileSettings components
    3. Finally, update the component tests
    
    Please proceed with these changes and let me know when you're done.
  `, {
    logFile: `${logFile}.continue`,
    stream: true,
    outputFormat: 'stream-json'
  });
  
  if (continueResult.success) {
    console.log(`✅ Continuation started with PID: ${continueResult.pid}`);
    console.log(`📄 Continuation log: ${logFile}.continue\n`);
    
    // Start monitoring the continuation
    const continueMonitor = startOutputMonitor(`${logFile}.continue`);
    
    console.log('\n⏳ Monitoring continued task...');
    console.log('   (Press Ctrl+C to exit)\n');
    
    // Keep process alive for monitoring
    process.stdin.resume();
  }
  
  // Cleanup function
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping monitors...');
    sessionMonitor.kill();
    outputMonitor.kill();
    process.exit();
  });
}

// Alternative: Check session status programmatically
async function checkSessionStatus(sessionName: string) {
  try {
    const s = await session.load(sessionName);
    const messages = s.messages();
    
    console.log(`\n📊 Session Status: ${sessionName}`);
    console.log(`   Messages: ${messages.length}`);
    console.log(`   Session ID: ${s.id() || 'Not started'}`);
    
    // Check if last message indicates waiting for feedback
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const needsFeedback = lastMessage.content.toLowerCase().includes('feedback') ||
                           lastMessage.content.toLowerCase().includes('prioritize') ||
                           lastMessage.content.toLowerCase().includes('should i');
      
      if (needsFeedback) {
        console.log('   Status: ⏸️  Waiting for feedback');
      } else {
        console.log('   Status: ✅ Complete or in progress');
      }
    }
  } catch (error) {
    console.log(`   Status: ❌ Session not found`);
  }
}

// Run the workflow or check status based on command line args
if (process.argv[2] === 'status') {
  checkSessionStatus(SESSION_NAME);
} else {
  runTaskWorkflow().catch(console.error);
}