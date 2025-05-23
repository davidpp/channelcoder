#!/usr/bin/env bun

/**
 * Quick Start Examples for ChannelCoder
 *
 * Simple examples to get you started with the SDK
 * 
 * Note: These examples require Claude CLI to be installed and configured.
 * Without it, they will show the structure but fail with API errors.
 */

import { cc } from '../src/index.js';
import { z } from 'zod';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this example file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function example1_basicPrompt() {
  console.log('=== Example 1: Basic Prompt ===\n');

  const name = 'Alice';
  const task = 'explain quantum computing';

  const result = await cc.prompt`
    Hi ${name}! Please ${task} in simple terms.
  `.run();

  if (result.success) {
    console.log('Response:', result.stdout || result.data);
  } else {
    console.log('Error:', result.error);
    console.log('Note: This example requires Claude CLI to be installed and configured.');
  }
}

async function example2_withTools() {
  console.log('\n=== Example 2: With Tools ===\n');

  const pattern = 'TODO';

  const result = await cc.prompt`
    Find all files containing "${pattern}" in the current directory.
    List just the filenames.
  `
    .withTools(['Read', 'Grep'])
    .run();

  if (result.success) {
    console.log('Files found:', result.stdout || 'None');
  }
}

async function example3_fileBasedPrompt() {
  console.log('\n=== Example 3: File-based Prompt ===\n');

  // Use absolute path relative to this example file
  const promptPath = join(__dirname, 'simple-greeting.md');
  
  const result = await cc.fromFile(promptPath, {
    name: 'Developer',
    greeting: 'Howdy',
  });

  if (result.success) {
    console.log('Greeting:', result.stdout);
  }
}

async function example4_withValidation() {
  console.log('\n=== Example 4: With Schema Validation ===\n');

  // Define expected output
  const AnalysisSchema = z.object({
    language: z.string(),
    purpose: z.string(),
    complexity: z.enum(['simple', 'moderate', 'complex']),
  });

  const code = `
    function fibonacci(n) {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    }
  `;

  const result = await cc.prompt`
    Analyze this code and return JSON:
    \`\`\`javascript
    ${code}
    \`\`\`
    
    Format:
    {
      "language": "detected language",
      "purpose": "what it does",
      "complexity": "simple|moderate|complex"
    }
  `
    .withSchema(AnalysisSchema)
    .run();

  if (result.success) {
    if (result.data) {
      const validated = cc.validate(result, AnalysisSchema);
      if (validated.success) {
        console.log('Analysis:', validated.data);
      } else {
        console.log('Validation failed:', validated.error);
      }
    } else {
      console.log('No data in response. Raw output:', result.stdout);
    }
  } else {
    console.log('Request failed:', result.error);
  }
}

async function example5_streaming() {
  console.log('\n=== Example 5: Streaming ===\n');

  console.log('Story: ');

  const prompt = cc.prompt`
    Tell a very short story (2-3 sentences) about a programmer
    learning a new tool called ChannelCoder.
  `;

  for await (const chunk of cc.stream(prompt)) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

// Check if Claude CLI is available
async function checkClaudeCLI() {
  try {
    const proc = Bun.spawn(['claude', '--version'], { stdout: 'pipe', stderr: 'pipe' });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (error) {
    return false;
  }
}

// Run all examples
async function main() {
  console.log('🚀 ChannelCoder Quick Start Examples\n');

  // Check if Claude CLI is available
  const hasClaudeCLI = await checkClaudeCLI();
  if (!hasClaudeCLI) {
    console.log('⚠️  Warning: Claude CLI not found or not configured.\n');
    console.log('These examples require Claude CLI to be installed and configured.');
    console.log('Visit: https://docs.anthropic.com/en/docs/claude-code/cli-usage\n');
    console.log('Running examples anyway (they will show errors)...\n');
  }

  try {
    await example1_basicPrompt();
    await example2_withTools();
    await example3_fileBasedPrompt();
    await example4_withValidation();
    await example5_streaming();

    console.log('\n✅ All examples completed!');
    console.log('\n📚 See examples/README.md for more details');
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

if (import.meta.main) {
  main();
}
