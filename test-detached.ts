#!/usr/bin/env bun

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { setTimeout } from 'timers/promises';
import { claude, detached } from './src/index.js';

console.log('🧪 Testing Detached Mode - ChannelCoder\n');

const logFile = 'test-detached-output.log';

// Clean up any existing log file
if (existsSync(logFile)) {
  console.log(`🧹 Cleaning up existing log file: ${logFile}`);
  unlinkSync(logFile);
}

console.log('🚀 Test 1: Basic detached execution with logging');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Start a detached process that counts
const prompt = `Count from 1 to 10 slowly, with 1 second between each number. 
Output each number on its own line with a timestamp like "2024-01-01 12:00:01: 1"`;

console.log(`📝 Prompt: "${prompt}"\n`);

try {
  // Launch in detached mode
  const result = await detached(prompt, {
    logFile,
    verbose: true,
  });

  if (result.success && result.data?.pid) {
    console.log(`✅ Started detached process with PID: ${result.data.pid}`);
    console.log(`📄 Log file: ${logFile}`);
    console.log(`🔄 Detached: ${result.data.detached}`);
  } else {
    console.error('❌ Failed to start detached process:', result);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error launching detached process:', error);
  process.exit(1);
}

// Wait and check for log file
console.log('\n⏳ Waiting 5 seconds for initial output...');
await setTimeout(5000);

if (!existsSync(logFile)) {
  console.error(`❌ Log file not created after 5 seconds: ${logFile}`);
  process.exit(1);
}

console.log('📄 Log file exists! Reading initial content:');
console.log('---');
console.log(readFileSync(logFile, 'utf-8'));
console.log('---');

// Test 2: Launch another task with different options
console.log('\n\n🚀 Test 2: Detached with complex task');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const complexPrompt = `Write a haiku about background processes in computing. 
Then list 3 benefits of detached execution.`;

const result2 = await claude(complexPrompt, {
  detached: true,
  logFile, // Append to same file
});

console.log(`✅ Started second detached process with PID: ${result2.data?.pid}`);

// Wait for both to complete
console.log('\n⏳ Waiting 30 seconds for processes to complete...');
await setTimeout(30000);

// Read final log content
console.log('\n📄 Final log file content:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const finalContent = readFileSync(logFile, 'utf-8');
console.log(finalContent);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Analyze results
const lines = finalContent.split('\n').filter((line) => line.trim());
console.log('\n📊 Results:');
console.log(`- Total lines in log: ${lines.length}`);
console.log(`- Log file size: ${finalContent.length} bytes`);

// Check if we got expected outputs
const hasNumbers = /\d+/.test(finalContent);
const hasHaiku = /haiku|process|background/i.test(finalContent);

console.log(`- Contains numbers: ${hasNumbers ? '✅' : '❌'}`);
console.log(`- Contains haiku/benefits: ${hasHaiku ? '✅' : '❌'}`);

if (hasNumbers && hasHaiku) {
  console.log('\n🎉 All detached tests passed!');
} else {
  console.log('\n⚠️  Some expected content missing');
}

// Cleanup option
console.log(`\n💡 Log file kept at: ${logFile}`);
console.log('   (Delete manually if needed)');
