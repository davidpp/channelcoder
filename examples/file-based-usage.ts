#!/usr/bin/env bun

import { claude } from '../src/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this example file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Using file-based prompts with ChannelCoder SDK
 */

async function main() {
  console.log('ChannelCoder SDK File-based Prompt Example\n');

  try {
    // Load and execute prompt from file
    const promptPath = join(__dirname, 'analyze-task.md');
    const result = await claude(promptPath, {
      data: {
        taskId: 'FEAT-AUTH-001',
        context: 'Implement user authentication with JWT tokens and refresh token support',
        includeDetails: true,
      }
    });

    console.log('Execution result:', result.success);

    if (result.success) {
      if (result.data) {
        console.log('\nParsed data:');
        console.log(JSON.stringify(result.data, null, 2));
      } else if (result.stdout) {
        console.log('\nRaw output:');
        console.log(result.stdout);
      }
    } else {
      console.error('Error:', result.error);
      if (result.stderr) {
        console.error('Stderr:', result.stderr);
      }
    }

    // Example with overriding file config
    console.log('\n\nOverriding file configuration...');
    const customResult = await claude(promptPath, {
      data: {
        taskId: 'FEAT-API-002',
        context: 'Create RESTful API endpoints',
        includeDetails: false,
      },
      tools: ['Read', 'Grep'], // Override tools specified in file
      system: 'Be extra concise'  // Override system prompt
    });

    if (customResult.success) {
      console.log('Custom execution succeeded');
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

if (import.meta.main) {
  main();
}
