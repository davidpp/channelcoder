#!/usr/bin/env bun

import { stream } from './src/index.js';

console.log('🧪 Testing ChannelCoder stream functionality\n');

// Test 1: Raw mode (default)
console.log('📝 Test 1: Raw stream mode (default)');
console.log('------------------------');
try {
  let count = 0;
  for await (const chunk of stream('What is 2+2? Just give me the number.')) {
    if (chunk.type === 'content') {
      process.stdout.write(`[${++count}] ${chunk.content}`);
    } else if (chunk.type === 'error') {
      console.error('\n❌ Error:', chunk.content);
    }
  }
  console.log('\n✅ Raw mode completed\n');
} catch (error) {
  console.error('❌ Stream failed:', error);
}

// Test 2: Parse mode
console.log('📝 Test 2: Parsed stream mode');
console.log('------------------------');
try {
  let count = 0;
  for await (const chunk of stream('What is 3+3? Just give me the number.', { parse: true })) {
    if (chunk.type === 'content' && chunk.content) {
      process.stdout.write(`[${++count}] ${chunk.content}`);
    } else if (chunk.type === 'error') {
      console.error('\n❌ Error:', chunk.content);
    }
  }
  console.log('\n✅ Parse mode completed\n');
} catch (error) {
  console.error('❌ Stream failed:', error);
}

// Test 3: Test with timeout
console.log('📝 Test 3: Stream with short timeout');
console.log('------------------------');
try {
  for await (const chunk of stream('Count slowly from 1 to 100', { timeout: 1000 })) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'error') {
      console.error('\n❌ Expected timeout error:', chunk.content);
      break;
    }
  }
} catch (error) {
  console.error('❌ Stream failed:', error);
}

console.log('\n\n🎉 Stream tests completed!');