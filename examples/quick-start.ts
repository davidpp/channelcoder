#!/usr/bin/env bun

/**
 * Quick Start Examples for ChannelCoder
 * 
 * Simple examples to get you started with the SDK
 */

import { cc } from 'channelcoder';
import { z } from 'zod';

async function example1_basicPrompt() {
  console.log('=== Example 1: Basic Prompt ===\n');
  
  const name = 'Alice';
  const task = 'explain quantum computing';
  
  const result = await cc.prompt`
    Hi ${name}! Please ${task} in simple terms.
  `.run();

  if (result.success) {
    console.log('Response:', result.stdout || result.data);
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
  
  const result = await cc.fromFile('examples/simple-greeting.md', {
    name: 'Developer',
    greeting: 'Howdy'
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
    complexity: z.enum(['simple', 'moderate', 'complex'])
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

  if (result.success && result.data) {
    const validated = cc.validate(result, AnalysisSchema);
    if (validated.success) {
      console.log('Analysis:', validated.data);
    }
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

// Run all examples
async function main() {
  console.log('🚀 ChannelCoder Quick Start Examples\n');
  
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