#!/usr/bin/env bun

import { claude } from '../src/index.js';

async function testDockerAuth() {
  console.log('Testing Docker authenticated image with ChannelCoder SDK...\n');

  try {
    // Simple math test - permissions skipped by default with Docker
    const result = await claude('What is 2 + 2?', {
      docker: { image: 'my-claude:authenticated' }
      // dangerouslySkipPermissions defaults to true with Docker
    });

    console.log('Claude response:', result.data);

    // Test with a code task
    console.log('\n---\n');
    
    const codeResult = await claude('Write a simple hello world function in TypeScript', {
      docker: { image: 'my-claude:authenticated' }
    });
    
    // Example: explicitly enable permission prompts (rare case)
    console.log('\n---\n');
    
    const promptResult = await claude('What is 5 + 5?', {
      docker: { image: 'my-claude:authenticated' },
      dangerouslySkipPermissions: false  // Explicitly enable permission prompts
    });

    console.log('Code task response:', codeResult.data);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testDockerAuth();