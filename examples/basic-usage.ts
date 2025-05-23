#!/usr/bin/env bun

import { z } from 'zod';
import { cc } from '../src/index.js';

/**
 * Example: Basic usage of CC SDK
 */

// 1. Simple inline prompt
async function example1() {
  console.log('Example 1: Simple inline prompt');

  const task = 'FEAT-123';
  const result = await cc.prompt`
    What is the status of task ${task}?
  `.run();

  console.log('Result:', result.success);
  if (result.stdout) {
    console.log('Response:', result.stdout);
  }
}

// 2. Prompt with system prompt and tools
async function example2() {
  console.log('\nExample 2: With system prompt and tools');

  const commits = ['fix: bug in parser', 'feat: add new API'];

  const result = await cc.prompt`
    Summarize these commits: ${commits}
  `
    .withSystemPrompt('You are a helpful commit analyzer')
    .withTools(['Read'])
    .run();

  console.log('Result:', result.success);
}

// 3. With output schema validation
async function example3() {
  console.log('\nExample 3: With schema validation');

  const AnalysisSchema = z.object({
    summary: z.string(),
    category: z.enum(['feature', 'bugfix', 'other']),
    impact: z.number().min(1).max(10),
  });

  const code = 'function add(a, b) { return a + b; }';

  const result = await cc.prompt`
    Analyze this code and return JSON:
    \`\`\`javascript
    ${code}
    \`\`\`
    
    Return analysis as:
    \`\`\`json
    {
      "summary": "description",
      "category": "feature|bugfix|other", 
      "impact": 1-10
    }
    \`\`\`
  `
    .withSchema(AnalysisSchema)
    .run();

  if (result.success && result.data) {
    const validated = cc.validate(result, AnalysisSchema);
    if (validated.success) {
      console.log('Validated data:', validated.data);
    }
  }
}

// 4. Streaming example
async function example4() {
  console.log('\nExample 4: Streaming response');

  const topic = 'TypeScript best practices';

  console.log('Streaming response:');
  for await (const chunk of cc.stream(cc.prompt`Tell me about ${topic} in 3 bullet points`)) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

// Run examples
async function main() {
  console.log('CC SDK Examples\n');

  try {
    await example1();
    await example2();
    await example3();
    await example4();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (import.meta.main) {
  main();
}
