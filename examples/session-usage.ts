#!/usr/bin/env node

/**
 * Session Management Examples for ChannelCoder
 * 
 * This example demonstrates how to use sessions to maintain
 * conversation context across multiple interactions.
 */

import { session } from '../dist/index.js';

async function main() {
  console.log('🔄 ChannelCoder Session Management Examples\n');

  // Example 1: Basic Session Usage
  console.log('1️⃣ Basic Session Usage');
  console.log('---------------------');
  
  const debugSession = session({ name: 'debug-session' });
  
  // First interaction
  console.log('Starting debug session...');
  const result1 = await debugSession.claude('I have a TypeScript error: "Cannot find module". What should I check first?', {
    dryRun: true,
  });
  console.log('Command:', result1.data.fullCommand);
  console.log('Session will track conversation automatically\n');

  // Follow-up (would use session context)
  console.log('Follow-up question...');
  const result2 = await debugSession.claude('The module is in node_modules but TypeScript still can\'t find it', {
    dryRun: true,
  });
  console.log('Command:', result2.data.fullCommand);
  console.log('Note: --resume flag is automatically added\n');

  // Example 2: Saving and Loading Sessions
  console.log('2️⃣ Saving and Loading Sessions');
  console.log('------------------------------');
  
  // Save the session
  console.log('Saving session as "typescript-debug"...');
  // In real usage: await debugSession.save('typescript-debug');
  console.log('Session saved to ~/.channelcoder/sessions/typescript-debug.json\n');

  // Load existing session
  console.log('Loading saved session...');
  // In real usage: const loadedSession = await session.load('typescript-debug');
  console.log('Session loaded with full conversation history\n');

  // Example 3: Session with File-based Prompts
  console.log('3️⃣ Session with File-based Prompts');
  console.log('----------------------------------');
  
  const featureSession = session({ name: 'feature-dev' });
  
  // Using a prompt file with session
  console.log('Using prompt file with session...');
  const result3 = await featureSession.claude('prompts/implement-feature.md', {
    data: {
      feature: 'user authentication',
      framework: 'Next.js'
    },
    dryRun: true,
  });
  console.log('Command:', result3.data.fullCommand);
  console.log('Session maintains context across file-based prompts\n');

  // Example 4: Listing Sessions
  console.log('4️⃣ Listing All Sessions');
  console.log('-----------------------');
  
  // List all saved sessions
  console.log('Getting list of saved sessions...');
  // In real usage: const sessions = await session.list();
  console.log('Example output:');
  console.log('  typescript-debug - 4 messages (last active: today)');
  console.log('  feature-dev - 2 messages (last active: yesterday)');
  console.log('  api-design - 6 messages (last active: 2 days ago)\n');

  // Example 5: Session-Required Prompts
  console.log('5️⃣ Session-Required Prompts');
  console.log('---------------------------');
  
  console.log('Example prompt with session requirement:');
  console.log(`
---
session:
  required: true
systemPrompt: "You are helping debug an ongoing issue"
---

Continue investigating the error we discussed.
Context from last message: {session.lastMessage}
`);
  console.log('This prompt will fail without a session context\n');

  // Example 6: CLI Integration
  console.log('6️⃣ CLI Integration');
  console.log('------------------');
  
  console.log('Start new session:');
  console.log('  channelcoder prompts/debug.md --session my-debug\n');
  
  console.log('Continue session:');
  console.log('  channelcoder prompts/continue.md --load-session my-debug\n');
  
  console.log('List all sessions:');
  console.log('  channelcoder --list-sessions\n');

  // Example 7: Streaming with Sessions
  console.log('7️⃣ Streaming with Sessions');
  console.log('-------------------------');
  
  const streamSession = session();
  console.log('Streaming maintains session context:');
  
  // In real usage:
  // for await (const chunk of streamSession.stream('Explain the error step by step')) {
  //   process.stdout.write(chunk.content);
  // }
  console.log('(Stream output would appear here)');
  console.log('Session ID is captured after streaming completes\n');

  // Tips
  console.log('💡 Tips:');
  console.log('--------');
  console.log('• Sessions automatically track conversation history');
  console.log('• Each response from Claude gets a new session ID');
  console.log('• Sessions are saved to ~/.channelcoder/sessions/ by default');
  console.log('• Use meaningful names for long-running conversations');
  console.log('• Sessions work with all ChannelCoder features (templates, validation, etc.)');
}

main().catch(console.error);