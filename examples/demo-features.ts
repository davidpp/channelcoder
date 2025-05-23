#!/usr/bin/env bun

/**
 * Demo: ChannelCoder Features
 * 
 * This demo shows all the SDK features without calling Claude CLI.
 * It demonstrates the API and shows what would be sent to Claude.
 */

import { cc } from '../src/index.js';
import { z } from 'zod';

console.log('🎯 ChannelCoder Feature Demo\n');
console.log('This demo shows SDK features without calling Claude CLI.\n');

// 1. Template Literal API
console.log('1️⃣ Template Literal API');
console.log('------------------------');
const name = 'Alice';
const task = 'explain quantum computing';
const prompt1 = cc.prompt`
  Hi ${name}! Please ${task} in simple terms.
`;
console.log('Built prompt:', prompt1.toString());
console.log();

// 2. Fluent Builder API
console.log('2️⃣ Fluent Builder API');
console.log('---------------------');
const prompt2 = cc.prompt`
  Find all TypeScript files with TODO comments.
`
  .withTools(['Read', 'Grep'])
  .withSystemPrompt('Be concise and accurate.');

console.log('Built prompt:', prompt2.toString());
console.log('With tools: Read, Grep');
console.log('With system prompt: Be concise and accurate.');
console.log();

// 3. Variable Interpolation Features
console.log('3️⃣ Variable Interpolation');
console.log('-------------------------');
const config = {
  port: 3000,
  host: 'localhost',
  ssl: true
};
const isProduction = true;
const features = ['auth', 'api', 'dashboard'];

const prompt3 = cc.prompt`
  Server Configuration:
  ${JSON.stringify(config, null, 2)}
  
  Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
  
  Active Features:
  ${features.map(f => `- ${f}`).join('\n')}
`;
console.log('Built prompt:');
console.log(prompt3.toString());
console.log();

// 4. Schema Validation
console.log('4️⃣ Schema Validation');
console.log('--------------------');
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest'])
});

const prompt4 = cc.prompt`
  Create a new user with the following details:
  - Name: John Doe
  - Email: john@example.com
  - Role: admin
  
  Return as JSON matching the schema.
`.withSchema(UserSchema);

console.log('Built prompt with output schema validation');
console.log('Expected output schema:', JSON.stringify({
  id: 'string (uuid)',
  name: 'string (min: 1)',
  email: 'string (email)',
  role: 'admin | user | guest'
}, null, 2));
console.log();

// 5. Conditional Content
console.log('5️⃣ Conditional Content');
console.log('----------------------');
const includeDetails = true;
const debugMode = false;
const priority = 'high';

const prompt5 = cc.prompt`
  Analyze the system performance.
  
  ${includeDetails ? `Include detailed metrics for:
  - CPU usage
  - Memory consumption
  - Network latency` : 'Provide summary only.'}
  
  ${debugMode ? 'Enable debug logging.' : ''}
  
  ${priority === 'high' ? '⚠️ This is a HIGH PRIORITY request!' : ''}
`;
console.log('Built prompt:');
console.log(prompt5.toString());
console.log();

// 6. File-based Prompts (showing the structure)
console.log('6️⃣ File-based Prompts');
console.log('---------------------');
console.log('Example prompt file structure:');
console.log(`
---
input:
  taskId: string
  priority?: string
  tags: string[]
output:
  success: boolean
  result: string
systemPrompt: "You are a helpful assistant"
allowedTools:
  - Read
  - Write
---

# Task Analysis for \${taskId}

Priority: \${priority || "normal"}
Tags: \${tags.join(", ")}

Please analyze this task...
`);
console.log();

// 7. Complex Nested Data
console.log('7️⃣ Complex Nested Data');
console.log('----------------------');
const project = {
  name: 'ChannelCoder',
  version: '1.0.0',
  dependencies: {
    zod: '^3.22.0',
    'gray-matter': '^4.0.3'
  },
  scripts: {
    build: 'tsc',
    test: 'vitest'
  }
};

const prompt7 = cc.prompt`
  Review this package.json:
  ${JSON.stringify(project, null, 2)}
  
  Check for:
  ${project.dependencies ? `- ${Object.keys(project.dependencies).length} dependencies` : '- No dependencies'}
  ${project.scripts ? `- ${Object.keys(project.scripts).length} scripts defined` : '- No scripts'}
`;
console.log('Built prompt with nested data:');
console.log(prompt7.toString().substring(0, 200) + '...');
console.log();

// 8. Array Processing
console.log('8️⃣ Array Processing');
console.log('-------------------');
const errors = [
  { file: 'app.ts', line: 42, message: 'Type error' },
  { file: 'utils.ts', line: 13, message: 'Undefined variable' }
];

const prompt8 = cc.prompt`
  Fix these errors:
  
  ${errors.map((err, i) => `${i + 1}. ${err.file}:${err.line} - ${err.message}`).join('\n')}
  
  Total errors: ${errors.length}
`;
console.log('Built prompt:');
console.log(prompt8.toString());
console.log();

console.log('✅ Demo completed!');
console.log('\nThis demo showed ChannelCoder features without calling Claude CLI.');
console.log('To actually execute prompts, you need Claude CLI installed and configured.');
console.log('\nSee examples/quick-start.ts for executable examples.');