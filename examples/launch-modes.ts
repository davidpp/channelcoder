#!/usr/bin/env bun

/**
 * Example: Different launch modes with ChannelCoder SDK
 * 
 * Demonstrates how to use the launch() method for various
 * interaction patterns with Claude.
 */

import { cc } from '../src/index.js';

async function interactiveExample() {
  console.log('=== Interactive Mode Example ===');
  console.log('Launching Claude interactively...\n');
  
  // This will take over your terminal, just like running `claude` directly
  const result = await cc.launch('Explain the concept of recursion with a simple example', {
    mode: 'interactive' // Default mode
  });
  
  console.log(`\nClaude exited with code: ${result.exitCode}`);
}

async function detachedExample() {
  console.log('\n=== Detached Mode Example ===');
  console.log('Launching Claude in detached mode...\n');
  
  // Fire and forget - Claude runs independently
  const result = await cc.launch('Write a detailed analysis of modern web frameworks', {
    mode: 'detached',
    logFile: 'claude-analysis.log'
  });
  
  if (result.pid) {
    console.log(`Claude launched with PID: ${result.pid}`);
    console.log('Check claude-analysis.log for output');
  } else if (result.error) {
    console.error(`Failed to launch: ${result.error}`);
  }
}

async function backgroundExample() {
  console.log('\n=== Background Mode Example ===');
  console.log('Launching Claude in background mode...\n');
  
  // Background process that we can still monitor
  const result = await cc.launch('Generate a comprehensive test suite for a React component', {
    mode: 'background',
    logFile: 'test-generation.log'
  });
  
  if (result.pid) {
    console.log(`Background process started with PID: ${result.pid}`);
    console.log('Process is running in background, check test-generation.log');
  }
}

async function withTemplateExample() {
  console.log('\n=== Launch with Template Variables ===');
  
  const taskId = 'FEAT-789';
  const priority = 'high';
  
  // Using template builder with launch
  await cc.prompt`
    Analyze task ${taskId} with priority ${priority}.
    Provide implementation recommendations.
  `.launch({ mode: 'interactive' });
}

async function main() {
  console.log('ChannelCoder Launch Modes Demo\n');
  
  const mode = process.argv[2] || 'interactive';
  
  switch (mode) {
    case 'interactive':
      await interactiveExample();
      break;
    case 'detached':
      await detachedExample();
      break;
    case 'background':
      await backgroundExample();
      break;
    case 'template':
      await withTemplateExample();
      break;
    case 'all':
      // Run non-interactive examples
      await detachedExample();
      await backgroundExample();
      console.log('\nRun with "interactive" or "template" to see interactive modes');
      break;
    default:
      console.log('Usage: bun run examples/launch-modes.ts [mode]');
      console.log('Modes: interactive, detached, background, template, all');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}