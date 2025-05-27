#!/usr/bin/env node

/**
 * Live Session Demo - Run this to test session functionality with real Claude CLI
 * 
 * Prerequisites:
 * - Claude CLI must be installed: npm install -g @anthropic-ai/claude-code
 * - Build the project first: bun run build
 * 
 * Usage:
 * - bun run examples/session-demo-live.ts
 */

import { session } from '../src/index.js';

async function runLiveDemo() {
  console.log('🔴 Live Session Demo with Claude CLI\n');
  console.log('This demo will make real API calls to Claude.\n');

  // Create a new session
  console.log('1️⃣ Creating a new session...');
  const s = session({ name: 'live-demo' });

  try {
    // First interaction
    console.log('\n📝 First message: Asking about TypeScript');
    const result1 = await s.claude('What is TypeScript in one sentence?', {
      verbose: true,
    });
    
    if (result1.success) {
      console.log('✅ Response received');
      console.log('Session ID:', s.id() || 'Not captured yet');
      console.log('Messages so far:', s.messages().length);
    } else {
      console.error('❌ Error:', result1.error);
      return;
    }

    // Wait a bit to see the response
    console.log('\n⏳ Waiting 2 seconds before next message...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second interaction - should automatically continue
    console.log('\n📝 Second message: Follow-up question');
    const result2 = await s.claude('What are its main benefits over JavaScript?', {
      verbose: true,
    });

    if (result2.success) {
      console.log('✅ Follow-up response received');
      console.log('Session maintained automatically!');
      console.log('Total messages:', s.messages().length);
    } else {
      console.error('❌ Error:', result2.error);
    }

    // Save the session
    console.log('\n💾 Saving session...');
    const savedPath = await s.save('typescript-intro');
    console.log(`Session saved to: ${savedPath}`);

    // List all sessions
    console.log('\n📋 All saved sessions:');
    const sessions = await session.list();
    for (const sess of sessions) {
      console.log(`  - ${sess.name}: ${sess.messageCount} messages`);
    }

  } catch (error) {
    console.error('❌ Demo error:', error);
  }
}

async function testSessionLoading() {
  console.log('\n\n2️⃣ Testing Session Loading...\n');

  try {
    // Try to load the previously saved session
    const loaded = await session.load('typescript-intro');
    console.log('✅ Session loaded successfully');
    console.log('Session ID:', loaded.id());
    console.log('Previous messages:', loaded.messages().length);

    // Continue the conversation
    console.log('\n📝 Continuing conversation...');
    const result = await loaded.claude('Can you give me a simple TypeScript example?', {
      verbose: true,
    });

    if (result.success) {
      console.log('✅ Conversation continued successfully!');
      console.log('The AI remembers our previous discussion about TypeScript');
    }

  } catch (error) {
    console.log('ℹ️  No saved session found (this is normal on first run)');
  }
}

async function testDryRun() {
  console.log('\n\n3️⃣ Testing Dry Run Mode...\n');

  const s = session();
  
  // First message
  console.log('First command (no resume):');
  const r1 = await s.claude('Hello', { dryRun: true });
  console.log(r1.data.fullCommand);
  
  // In dry-run mode, session IDs aren't captured, so we can't test resume behavior
  console.log('\nNote: In dry-run mode, session IDs are not captured from Claude.');
  console.log('With real Claude CLI, the second command would include --resume flag.');
  
  // But we can test that commands are generated correctly
  console.log('\nSecond command (also without resume in dry-run):');
  const r2 = await s.claude('Continue', { dryRun: true });
  console.log(r2.data.fullCommand);
}

async function main() {
  console.log('🚀 ChannelCoder Session Feature Demo\n');
  
  // Check if Claude CLI is available
  try {
    const { execSync } = await import('child_process');
    execSync('claude --version', { stdio: 'ignore' });
    console.log('✅ Claude CLI detected\n');
  } catch {
    console.log('⚠️  Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
    console.log('   Running in dry-run mode instead...\n');
    await testDryRun();
    return;
  }

  // Run the live demo
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    await testDryRun();
  } else {
    console.log('💡 Tip: Use --dry-run to test without making API calls\n');
    await runLiveDemo();
    await testSessionLoading();
  }
}

main().catch(console.error);