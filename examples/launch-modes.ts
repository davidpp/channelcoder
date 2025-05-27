#!/usr/bin/env bun

/**
 * Example: Different execution modes with ChannelCoder SDK
 * 
 * Demonstrates how to use different execution modes:
 * - run: Execute and get results
 * - stream: Stream responses
 * - interactive: Launch Claude interactively
 */

import { claude, interactive, stream, run } from '../src/index.js';

async function runExample() {
  console.log('=== Run Mode Example ===');
  console.log('Executing prompt and getting result...\n');
  
  const result = await run('Explain the concept of recursion with a simple example');
  
  console.log('Success:', result.success);
  if (result.data) {
    console.log('Response:', result.data);
  }
  
  // Also works with claude() directly
  const result2 = await claude('What is 2+2?', { mode: 'run' });
  console.log('\nDirect claude() call:', result2.data);
}

async function streamExample() {
  console.log('\n=== Stream Mode Example ===');
  console.log('Streaming response...\n');
  
  // Using the stream function
  for await (const chunk of stream('Write a haiku about programming')) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  
  console.log('\n\nStreaming with options:');
  for await (const chunk of stream('List 3 benefits of TypeScript', { 
    system: 'Be very concise' 
  })) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

async function interactiveExample() {
  console.log('\n=== Interactive Mode Example ===');
  console.log('Launching Claude interactively...');
  console.log('⚠️  This will REPLACE the current process!\n');
  
  // This will replace the Node.js process with Claude
  // No code after this line will execute!
  await interactive('Help me debug a complex issue');
  
  // This line will NEVER be reached
  console.error('ERROR: This should never print!');
}

async function templateExample() {
  console.log('\n=== Template Literal Example ===');
  
  const language = 'TypeScript';
  const topic = 'generics';
  
  // Using template literals
  const result = await claude`
    Explain ${topic} in ${language} with a practical example.
    Keep it under 100 words.
  `;
  
  console.log('Template result:', result.data);
}

async function fileExample() {
  console.log('\n=== File-based Prompt Example ===');
  
  // When the first argument ends with .md, it's treated as a file
  const result = await claude('examples/analyze-task.md', {
    data: {
      taskId: 'FEAT-SDK-001',
      context: 'Redesign the SDK to use functions',
      includeDetails: true
    }
  });
  
  console.log('File execution success:', result.success);
}

async function main() {
  console.log('ChannelCoder Execution Modes Demo\n');
  
  const mode = process.argv[2] || 'run';
  
  switch (mode) {
    case 'run':
      await runExample();
      break;
    case 'stream':
      await streamExample();
      break;
    case 'interactive':
      await interactiveExample();
      break;
    case 'template':
      await templateExample();
      break;
    case 'file':
      await fileExample();
      break;
    case 'all':
      // Run non-interactive examples
      await runExample();
      await streamExample();
      await templateExample();
      await fileExample();
      console.log('\nRun with "interactive" to see interactive mode');
      break;
    default:
      console.log('Usage: bun run examples/launch-modes.ts [mode]');
      console.log('Modes: run, stream, interactive, template, file, all');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}