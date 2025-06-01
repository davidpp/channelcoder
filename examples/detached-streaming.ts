#!/usr/bin/env node

/**
 * Detached Streaming Example
 * 
 * Demonstrates the new detached streaming capabilities:
 * 1. Detached mode with real-time log streaming
 * 2. Session management with real-time session file updates
 * 3. Monitoring both Claude output and session state
 */

import { detached, session } from '../src/index.js';
import { watch } from 'fs';
import { readFile } from 'fs/promises';

async function basicDetachedStreaming() {
  console.log('🚀 Basic Detached Streaming Example');
  console.log('=====================================');

  // Start detached process with streaming output
  const result = await detached('Write a long story about AI and humanity', {
    logFile: 'claude-output.log',
    stream: true, // Enable real-time streaming to log file
    data: { theme: 'cooperation' }
  });

  if (result.success) {
    console.log(`✅ Detached process started with PID: ${result.data?.pid}`);
    console.log(`📝 Streaming output to: ${result.data?.logFile}`);
    console.log(`🌊 Real-time streaming: ${result.data?.streaming}`);
    console.log('\n💡 Monitor in real-time with:');
    console.log(`   tail -f ${result.data?.logFile}`);
    console.log('   # or parse JSON chunks:');
    console.log(`   tail -f ${result.data?.logFile} | jq -r '.content'`);
  } else {
    console.error('❌ Failed to start detached process:', result.error);
  }
}

async function sessionDetachedStreaming() {
  console.log('\n🔗 Session + Detached Streaming Example');
  console.log('========================================');

  // Create a session for conversation tracking
  const s = session({ 
    name: 'ai-story-session',
    autoSave: true // Enable real-time session file updates
  });

  // Start conversation with streaming
  console.log('📝 Starting conversation...');
  await s.claude('I want to write a science fiction story about AI');

  // Continue with detached streaming
  const result = await s.detached('Generate a detailed 2000-word story based on our discussion', {
    logFile: 'session-story-output.log',
    stream: true
  });

  if (result.success) {
    console.log(`✅ Session detached process started`);
    console.log(`📊 Session ID: ${s.id()}`);
    console.log(`💬 Messages so far: ${s.messages().length}`);
    console.log(`📝 Story output: session-story-output.log`);
    
    // Save the session
    const sessionPath = await s.save();
    console.log(`💾 Session saved to: ${sessionPath}`);
    
    console.log('\n💡 Monitor both:');
    console.log('   # Claude output:');
    console.log('   tail -f session-story-output.log | jq -r ".content"');
    console.log('   # Session state updates:');
    console.log(`   watch -n 1 "cat ${sessionPath} | jq '.messages[-1].content'")`);
  }
}

async function monitoringExample() {
  console.log('\n👀 Real-time Monitoring Example');
  console.log('================================');

  // Start a long-running detached process
  const result = await detached('Analyze a complex codebase and provide insights', {
    logFile: 'analysis.log',
    stream: true,
    tools: ['Read', 'Grep'],
    maxTurns: 5
  });

  if (result.success) {
    console.log(`✅ Started analysis with PID: ${result.data?.pid}`);
    
    // Set up file watcher for real-time monitoring
    console.log('🔍 Setting up real-time monitoring...');
    
    let chunkCount = 0;
    const watcher = watch('analysis.log', async (eventType) => {
      if (eventType === 'change') {
        try {
          const content = await readFile('analysis.log', 'utf-8');
          const lines = content.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          
          if (lastLine) {
            try {
              const chunk = JSON.parse(lastLine);
              if (chunk.content) {
                chunkCount++;
                console.log(`📦 Chunk ${chunkCount}: ${chunk.content.substring(0, 50)}...`);
              }
            } catch {
              // Not JSON, might be final output
            }
          }
        } catch (error) {
          // File might be temporarily unavailable
        }
      }
    });

    // Stop monitoring after 30 seconds (in real usage, you'd monitor until completion)
    setTimeout(() => {
      watcher.close();
      console.log('\n⏹️  Stopped monitoring (demo timeout)');
      console.log('💡 In production, monitor until process completes');
    }, 30000);
    
    console.log('⏱️  Monitoring for 30 seconds...');
  }
}

async function main() {
  try {
    await basicDetachedStreaming();
    await sessionDetachedStreaming();
    await monitoringExample();
    
    console.log('\n🎉 All examples completed!');
    console.log('\n📚 Key Features Demonstrated:');
    console.log('   ✅ Detached processes with real-time log streaming');
    console.log('   ✅ Session management with auto-save');
    console.log('   ✅ Real-time monitoring of both Claude output and session state');
    console.log('   ✅ Unix-composable approach (tail, jq, watch)');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { basicDetachedStreaming, sessionDetachedStreaming, monitoringExample };