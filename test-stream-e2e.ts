#!/usr/bin/env bun

import { stream } from './src/index.js';

console.log('🧪 E2E Stream Test - ChannelCoder\n');

// Test 1: Raw mode - see exactly what Claude outputs
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 Test 1: Raw Stream Mode (default)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Prompt: "Write a haiku about streaming data"\n');
console.log('Raw output chunks:');
console.log('---');

try {
  let chunkCount = 0;
  let fullResponse = '';
  
  for await (const chunk of stream('Write a haiku about streaming data')) {
    chunkCount++;
    if (chunk.type === 'content') {
      console.log(`\n[Chunk ${chunkCount}]:`);
      console.log(JSON.stringify(chunk.content));
      fullResponse += chunk.content;
    } else if (chunk.type === 'error') {
      console.error(`\n❌ Error in chunk ${chunkCount}:`, chunk.content);
    }
  }
  
  console.log('\n---');
  console.log(`✅ Received ${chunkCount} chunks`);
  console.log('\nFull response:');
  console.log(fullResponse);
} catch (error) {
  console.error('❌ Stream failed:', error);
}

// Test 2: Parse mode - see parsed JSON messages
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 Test 2: Parsed Stream Mode');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Prompt: "Count from 1 to 5, one number per line"\n');
console.log('Parsed chunks:');
console.log('---');

try {
  let chunkCount = 0;
  let fullResponse = '';
  
  for await (const chunk of stream('Count from 1 to 5, one number per line', { parse: true })) {
    chunkCount++;
    if (chunk.type === 'content' && chunk.content) {
      console.log(`\n[Chunk ${chunkCount}] type=${chunk.type}:`);
      console.log(chunk.content);
      fullResponse += chunk.content;
    } else if (chunk.type === 'error') {
      console.error(`\n❌ Error in chunk ${chunkCount}:`, chunk.content);
    } else if (chunk.type === 'tool_use' || chunk.type === 'tool_result') {
      console.log(`\n[Chunk ${chunkCount}] type=${chunk.type}:`);
      console.log(chunk.content);
    }
  }
  
  console.log('\n---');
  console.log(`✅ Received ${chunkCount} chunks (non-empty)`);
  console.log('\nFull response:');
  console.log(fullResponse);
} catch (error) {
  console.error('❌ Stream failed:', error);
}

// Test 3: Complex prompt with longer response
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 Test 3: Longer Response Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Prompt: "Explain streaming in 3 sentences"\n');

try {
  let chunkCount = 0;
  let startTime = Date.now();
  
  console.log('Streaming response:');
  for await (const chunk of stream('Explain what streaming means in programming in exactly 3 sentences.')) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
      chunkCount++;
    } else if (chunk.type === 'error') {
      console.error('\n❌ Error:', chunk.content);
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`\n\n✅ Streamed ${chunkCount} chunks in ${duration}ms`);
} catch (error) {
  console.error('❌ Stream failed:', error);
}

console.log('\n\n🎉 E2E Stream tests completed!');