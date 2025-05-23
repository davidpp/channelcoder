#!/usr/bin/env bun

import { cc } from '../src/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this example file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Using file-based prompts with CC SDK
 */

async function main() {
  console.log('CC SDK File-based Prompt Example\n');

  try {
    // Load and execute prompt from file
    const promptPath = join(__dirname, 'analyze-task.md');
    const result = await cc.fromFile(promptPath, {
      taskId: 'FEAT-AUTH-001',
      context: 'Implement user authentication with JWT tokens and refresh token support',
      includeDetails: true,
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

    // Example with validation error (missing required field)
    console.log('\n\nTesting validation...');
    const invalidResult = await cc.fromFile(promptPath, {
      // Missing required 'taskId' field
      context: 'Some context',
    });

    if (!invalidResult.success) {
      console.log('Validation failed as expected:', invalidResult.error);
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

if (import.meta.main) {
  main();
}
