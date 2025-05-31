#!/usr/bin/env bun

import { claude } from './src/index.js';

console.log('🧪 Testing Frontmatter AllowedTools Execution\n');

// Test 1: Dry run to verify frontmatter is parsed correctly
console.log('Test 1: Dry run - verify frontmatter parsing');
console.log('=' .repeat(60));

const dryResult = await claude('test-frontmatter-tools.md', {
  dryRun: true
});

if (dryResult.success && dryResult.data) {
  console.log('✅ Dry run successful');
  console.log('📋 Command args:', dryResult.data.args);
  
  const allowedToolsIndex = dryResult.data.args.indexOf('--allowedTools');
  if (allowedToolsIndex !== -1) {
    console.log('✅ AllowedTools from frontmatter:', dryResult.data.args[allowedToolsIndex + 1]);
  } else {
    console.log('❌ AllowedTools not found in command');
  }
}

console.log('\n' + '=' .repeat(60) + '\n');

// Test 2: Real execution
console.log('Test 2: Real execution with frontmatter allowedTools');
console.log('=' .repeat(60));
console.log('Running prompt file with frontmatter restrictions...\n');

const realResult = await claude('test-frontmatter-tools.md', {
  verbose: true
});

if (realResult.success) {
  console.log('\n✅ Execution completed successfully');
  console.log('\n📝 Response:');
  console.log(realResult.data || realResult.stdout);
} else {
  console.log('\n❌ Execution failed:', realResult.error);
  if (realResult.stderr) {
    console.log('Stderr:', realResult.stderr);
  }
}

console.log('\n✅ Test completed!');

// Clean up
await Bun.$`rm -f test-frontmatter-tools.md`.quiet();