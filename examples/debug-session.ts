#!/usr/bin/env node

/**
 * Debugging Session Example
 * 
 * Shows how to use sessions for multi-step debugging workflows
 */

import { session } from '../dist/index.js';

async function debuggingWorkflow() {
  console.log('🐛 Debugging Session Example\n');

  // Create a new debugging session
  const debug = session({ name: 'typescript-error-debug' });

  console.log('Step 1: Initial Error Report');
  console.log('----------------------------');
  
  // First message - describe the error
  const result1 = await debug.claude(`
I'm getting this TypeScript error in my Next.js app:

\`\`\`
Type error: Cannot find module '@/components/Button' or its corresponding type declarations.

  1 | import { Button } from '@/components/Button';
    |                        ^
\`\`\`

The file definitely exists at src/components/Button.tsx. What could be wrong?
  `, { dryRun: true });

  console.log('✅ Session started with error description');
  console.log(`Session ID would be: ${result1.data?.sessionId || '[generated]'}\n`);

  console.log('Step 2: Follow-up with more context');
  console.log('-----------------------------------');
  
  // The session remembers the previous context
  const result2 = await debug.claude(`
Here's my tsconfig.json:

\`\`\`json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "es2017"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
\`\`\`
  `, { dryRun: true });

  console.log('✅ Added tsconfig.json to the conversation');
  console.log('The AI now has context about both the error and configuration\n');

  console.log('Step 3: Trying suggested solutions');
  console.log('----------------------------------');
  
  const result3 = await debug.claude(
    'I added the baseUrl but it\'s still not working. Could it be related to the Next.js configuration?',
    { dryRun: true }
  );

  console.log('✅ Continuing the debugging conversation');
  console.log('The AI remembers all previous messages and can provide targeted help\n');

  console.log('Step 4: Saving the session');
  console.log('-------------------------');
  
  // Save for later reference
  // await debug.save('typescript-import-debug');
  console.log('💾 Session saved as "typescript-import-debug"');
  console.log('You can continue this debugging session later with:');
  console.log('  const debug = await session.load("typescript-import-debug");\n');

  console.log('Session Summary:');
  console.log('---------------');
  const messages = debug.messages();
  console.log(`Total messages: ${messages.length}`);
  console.log(`Current session ID: ${debug.id() || '[would be generated]'}`);
  console.log('\nThis session can be resumed at any time to continue debugging!');
}

// Example of loading and continuing a session
async function continueDebugging() {
  console.log('\n📂 Continuing a Previous Session\n');

  // Load the saved session
  // const debug = await session.load('typescript-import-debug');
  
  console.log('Loaded session: typescript-import-debug');
  console.log('Previous messages are available for context\n');

  // Continue where we left off
  console.log('Continuing the conversation...');
  // await debug.claude('I found the issue! The paths were missing. Here\'s what fixed it...');
  
  console.log('✅ Session continues seamlessly with full context');
}

async function main() {
  await debuggingWorkflow();
  await continueDebugging();
  
  console.log('\n💡 Key Benefits:');
  console.log('• No need to repeat context in each message');
  console.log('• AI remembers the entire debugging journey');
  console.log('• Can pause and resume debugging sessions');
  console.log('• Perfect for complex, multi-step troubleshooting');
}

main().catch(console.error);