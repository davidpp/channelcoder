#!/usr/bin/env node
/**
 * Example: Real-time monitoring of detached sessions
 * 
 * This example shows how to monitor a Claude log file in real-time
 * as a detached session writes to it.
 */

import { monitorLog, streamParser, detached } from '../src/index.js';
import type { ClaudeEvent } from '../src/index.js';

// Monitor a log file and display events in real-time
async function monitorSession(logPath: string) {
  console.log(`📡 Monitoring log file: ${logPath}\n`);
  
  let messageCount = 0;
  let lastContent = '';
  
  const cleanup = monitorLog(logPath, (event: ClaudeEvent) => {
    // Display different event types
    switch (event.type) {
      case 'system':
        console.log(`🔧 System initialized - Session: ${event.session_id}`);
        if (event.tools && event.tools.length > 0) {
          console.log(`   Tools: ${event.tools.slice(0, 3).join(', ')}...`);
        }
        break;
        
      case 'assistant':
        if (streamParser.isAssistantEvent(event)) {
          messageCount++;
          const text = streamParser.extractAssistantText(event);
          
          // For streaming, show incremental content
          if (text.startsWith(lastContent)) {
            // Show only new content
            const newContent = text.substring(lastContent.length);
            process.stdout.write(newContent);
          } else {
            // New message
            console.log(`\n💬 Assistant [${messageCount}]: ${text}`);
          }
          lastContent = text;
        }
        break;
        
      case 'tool_use':
        console.log(`\n🔨 Tool use: ${event.tool}`);
        console.log(`   Input: ${JSON.stringify(event.input).substring(0, 100)}...`);
        break;
        
      case 'tool_result':
        console.log(`✅ Tool result: ${event.tool}`);
        const output = typeof event.output === 'string' 
          ? event.output.substring(0, 100) 
          : JSON.stringify(event.output).substring(0, 100);
        console.log(`   Output: ${output}...`);
        break;
        
      case 'error':
        console.log(`\n❌ Error: ${event.error}`);
        break;
        
      case 'result':
        if (streamParser.isResultEvent(event)) {
          console.log(`\n📊 Task ${event.subtype === 'success' ? 'completed' : 'failed'}`);
          console.log(`   Cost: $${event.cost_usd}`);
          console.log(`   Duration: ${event.duration_ms}ms`);
          console.log(`   Turns: ${event.num_turns}`);
          
          // Task complete, could exit
          console.log('\n✨ Monitoring complete. Press Ctrl+C to exit.');
        }
        break;
    }
  });
  
  console.log('Waiting for events... (Press Ctrl+C to stop)\n');
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping monitor...');
    cleanup();
    process.exit(0);
  });
  
  // Keep process alive
  await new Promise(() => {}); // Wait forever
}

// Example: Start a detached task and monitor it
async function startAndMonitor() {
  console.log('🚀 Starting detached task with monitoring...\n');
  
  const logFile = `detached-example-${Date.now()}.log`;
  
  // Start monitoring first (to catch all events)
  const monitorPromise = monitorSession(logFile);
  
  // Give monitor time to start
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Start detached task
  const result = await detached(`
    Demonstrate the monitoring capabilities by:
    1. First, list 3 programming languages
    2. Use the Read tool to check if package.json exists
    3. Finally, calculate 42 * 42
    
    Take your time and explain each step.
  `, {
    logFile,
    stream: true,
    outputFormat: 'stream-json',
  });
  
  if (result.success) {
    console.log(`\n✅ Detached task started with PID: ${result.pid}`);
    console.log(`📄 Log file: ${logFile}\n`);
  } else {
    console.error('Failed to start task:', result.error);
    process.exit(1);
  }
  
  // Wait for monitoring
  await monitorPromise;
}

// Example: Monitor with async iteration
async function monitorWithAsyncIteration(logPath: string) {
  console.log('\n🔄 Monitoring with async iteration...\n');
  
  const { events, cleanup } = streamParser.createAsyncMonitor(logPath);
  
  try {
    for await (const event of events) {
      if (streamParser.isAssistantEvent(event)) {
        const text = streamParser.extractAssistantText(event);
        console.log(`Assistant: ${text.substring(0, 80)}...`);
      }
      
      // Stop after result
      if (event.type === 'result') {
        break;
      }
    }
  } finally {
    cleanup();
  }
}

// Main function
async function main() {
  const mode = process.argv[2];
  const logPath = process.argv[3];
  
  if (mode === 'monitor' && logPath) {
    // Monitor existing log file
    await monitorSession(logPath);
  } else if (mode === 'start') {
    // Start new task and monitor
    await startAndMonitor();
  } else if (mode === 'async' && logPath) {
    // Use async iteration
    await monitorWithAsyncIteration(logPath);
  } else {
    console.error('Usage:');
    console.error('  Monitor existing log:');
    console.error('    bun run examples/monitor-detached.ts monitor <log-file>');
    console.error('');
    console.error('  Start and monitor new task:');
    console.error('    bun run examples/monitor-detached.ts start');
    console.error('');
    console.error('  Monitor with async iteration:');
    console.error('    bun run examples/monitor-detached.ts async <log-file>');
    process.exit(1);
  }
}

main().catch(console.error);