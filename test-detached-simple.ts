#!/usr/bin/env bun

import { detached } from './src/index.js';

console.log('Testing detached mode...');

const result = await detached('TEST: What is 2+2? Just give the number.', {
  logFile: 'test-simple.log',
  stream: true,
  outputFormat: 'stream-json'
});

console.log('Result:', result);

if (result.success) {
  console.log('✅ Success!');
  console.log('Check output with: tail -f test-simple.log | jq -r ".content // .error // ."');
} else {
  console.log('❌ Failed:', result.error);
}