#!/usr/bin/env bun

/**
 * Example: Interactive Mode with Process Replacement
 * 
 * This example demonstrates how interactive mode completely replaces
 * the Node.js process with Claude, providing a clean terminal experience
 * without memory overhead.
 */

import { interactive } from '../src/index.js';

console.log('🚀 ChannelCoder Interactive Mode Demo\n');

console.log('This demo shows how interactive mode works:');
console.log('1. The Node.js process will be completely replaced');
console.log('2. Claude will take over your terminal directly');
console.log('3. No parent process remains in memory');
console.log('4. Exit codes go directly to your shell\n');

console.log('Benefits:');
console.log('✅ No memory overhead from Node.js wrapper');
console.log('✅ Direct signal handling (Ctrl+C works naturally)');
console.log('✅ Perfect for long Claude sessions');
console.log('✅ Exactly like running `claude` in your terminal\n');

// Optional: Load task context or prepare data
const context = process.argv[2] || 'general assistance';

console.log(`Starting interactive session with context: "${context}"\n`);
console.log('─'.repeat(60));
console.log('⚠️  Node.js process will now be replaced by Claude...\n');

// This replaces the entire process
await interactive(`Hi Claude! I need help with ${context}. This is an interactive session launched from ChannelCoder.`);

// ❌ NOTHING BELOW THIS LINE WILL EVER EXECUTE ❌

console.error('ERROR: This line should never be printed!');
console.error('If you see this, something went wrong with process replacement.');
process.exit(1);