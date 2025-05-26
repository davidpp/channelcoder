#!/usr/bin/env bun

import { claude, stream } from '../src/index.js';

/**
 * Example: Basic usage of ChannelCoder SDK
 */

// 1. Simple inline prompt
async function example1() {
  console.log('Example 1: Simple inline prompt');

  const task = 'FEAT-123';
  const result = await claude`What is the status of task ${task}?`;

  console.log('Result:', result.success);
  if (result.data) {
    console.log('Response:', result.data);
  }
}

// 2. Prompt with system prompt and tools
async function example2() {
  console.log('\nExample 2: With system prompt and tools');

  const commits = ['fix: bug in parser', 'feat: add new API'];

  const result = await claude('Summarize these commits: ' + commits.join(', '), {
    system: 'You are a helpful commit analyzer',
    tools: ['Read']
  });

  console.log('Result:', result.success);
  if (result.data) {
    console.log('Response:', result.data);
  }
}

// 3. Prompt with data interpolation
async function example3() {
  console.log('\nExample 3: With data interpolation');

  const result = await claude('Analyze {code} and describe what it does', {
    data: {
      code: 'function add(a, b) { return a + b; }'
    }
  });

  console.log('Result:', result.success);
  if (result.data) {
    console.log('Analysis:', result.data);
  }
}

// 4. Streaming example
async function example4() {
  console.log('\nExample 4: Streaming response');

  const topic = 'TypeScript best practices';

  console.log('Streaming response:');
  for await (const chunk of stream(`Tell me about ${topic} in 3 bullet points`)) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

// 5. Session continuation example
async function example5() {
  console.log('\nExample 5: Session continuation');

  // First message
  const first = await claude('Remember the number 42');
  console.log('First response:', first.success);
  
  if (first.metadata?.sessionId) {
    // Continue the conversation
    const second = await claude('What number did I ask you to remember?', {
      resume: first.metadata.sessionId
    });
    
    console.log('Second response:', second.success);
    if (second.data) {
      console.log('Claude remembered:', second.data);
    }
  }
}

// Run examples
async function main() {
  console.log('ChannelCoder SDK Examples\n');

  try {
    await example1();
    await example2();
    await example3();
    await example4();
    await example5();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (import.meta.main) {
  main();
}
