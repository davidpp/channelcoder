#!/usr/bin/env bun

/**
 * Example: Dry Run Mode
 * 
 * Shows how to generate Claude CLI commands without executing them.
 * Useful for debugging, testing, or building command pipelines.
 */

import { claude, stream, interactive } from '../src/index.js';

async function main() {
  console.log('🔍 ChannelCoder Dry Run Demo\n');
  console.log('Generate Claude CLI commands without executing them:\n');

  // Example 1: Basic dry run
  console.log('=== Basic Command ===');
  const result1 = await claude('Explain recursion', { 
    dryRun: true 
  });
  console.log('Command:', result1.data?.fullCommand);

  // Example 2: With options
  console.log('\n=== With Options ===');
  const result2 = await claude('Review this code', {
    tools: ['Read', 'Grep'],
    system: 'You are a code reviewer',
    maxTurns: 5,
    dryRun: true
  });
  console.log('Command:', result2.data?.fullCommand);

  // Example 3: File-based prompt
  console.log('\n=== File-based Prompt ===');
  const result3 = await claude('examples/analyze-task.md', {
    data: { 
      taskId: 'FEAT-123',
      context: 'Performance optimization'
    },
    dryRun: true
  });
  console.log('Command:', result3.data?.fullCommand);
  console.log('Raw prompt:', result3.data?.prompt?.substring(0, 100) + '...');

  // Example 4: Template literals
  console.log('\n=== Template Literals ===');
  const language = 'TypeScript';
  const topic = 'async/await';
  const result4 = await claude`
    Explain ${topic} in ${language}.
    Include practical examples.
  `, { dryRun: true });
  console.log('Command:', result4.data?.fullCommand);

  // Example 5: Session resumption
  console.log('\n=== Resume Session ===');
  const result5 = await claude('Continue our discussion', {
    resume: 'session-abc123',
    dryRun: true
  });
  console.log('Command:', result5.data?.fullCommand);
  console.log('Note: No prompt piped when resuming');

  // Example 6: Continue last session
  console.log('\n=== Continue Last Session ===');
  const result6 = await claude('What were we discussing?', {
    continue: true,
    dryRun: true
  });
  console.log('Command:', result6.data?.fullCommand);

  // Example 7: Complex prompt with escaping
  console.log('\n=== Complex Prompt Escaping ===');
  const complexPrompt = `Fix this bash script:
#!/bin/bash
echo "Hello, $USER!"
if [ "$1" = "test" ]; then
  echo 'Running tests...'
fi`;
  
  const result7 = await claude(complexPrompt, {
    tools: ['Edit', 'Bash'],
    dryRun: true
  });
  console.log('Command:', result7.data?.fullCommand);
  console.log('\nNotice how quotes and special characters are properly escaped!');
}

main().catch(console.error);