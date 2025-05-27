#!/usr/bin/env bun

/**
 * Demo: ChannelCoder Features
 * 
 * This demo shows all the SDK features without calling Claude CLI.
 * It demonstrates the API and shows what would be sent to Claude.
 */

console.log('🎯 ChannelCoder Feature Demo\n');
console.log('This demo shows SDK features without calling Claude CLI.\n');

// 1. Basic Function Call
console.log('1️⃣ Basic Function Call');
console.log('----------------------');
console.log('Code:');
console.log(`  await claude('What is TypeScript?')`);
console.log('\nThis sends a simple prompt to Claude and returns the result.');
console.log();

// 2. Template Literal Support
console.log('2️⃣ Template Literal Support');
console.log('---------------------------');
const language = 'TypeScript';
const topic = 'generics';
console.log('Code:');
console.log(`  const language = 'TypeScript';
  const topic = 'generics';
  await claude\`Explain \${topic} in \${language}\``);
console.log('\nTemplate literals are automatically interpolated.');
console.log();

// 3. File-based Prompts
console.log('3️⃣ File-based Prompts');
console.log('---------------------');
console.log('Code:');
console.log(`  await claude('prompts/analyze.md', {
    data: { taskId: 'FEAT-123', priority: 'high' }
  })`);
console.log('\nFiles ending in .md are loaded and variables are interpolated.');
console.log();

// 4. Options and Tools
console.log('4️⃣ Options and Tools');
console.log('--------------------');
console.log('Code:');
console.log(`  await claude('Review this code', {
    tools: ['Read', 'Grep'],
    system: 'You are a code reviewer',
    maxTurns: 10
  })`);
console.log('\nOptions map directly to Claude CLI flags.');
console.log();

// 5. Execution Modes
console.log('5️⃣ Execution Modes');
console.log('------------------');
console.log('Code:');
console.log(`  // Different ways to execute
  await run('Quick analysis')         // Get result
  await interactive('Debug session')  // Interactive mode
  for await (const chunk of stream('Generate code')) {
    console.log(chunk.content)        // Stream output
  }`);
console.log();

// 6. Data Interpolation
console.log('6️⃣ Data Interpolation');
console.log('---------------------');
console.log('Code:');
console.log(`  await claude('Analyze {code} for {issues}', {
    data: {
      code: 'const x = null',
      issues: ['null safety', 'type errors']
    }
  })`);
console.log('\nVariables in {} are replaced with data values.');
console.log();

// 7. Session Continuation
console.log('7️⃣ Session Continuation');
console.log('-----------------------');
console.log('Code:');
console.log(`  const first = await claude('Remember: 42');
  const second = await claude('What number?', {
    resume: first.metadata?.sessionId
  })`);
console.log('\nSessions allow multi-turn conversations.');
console.log();

// 8. Tool Restrictions
console.log('8️⃣ Tool Restrictions');
console.log('--------------------');
console.log('Code:');
console.log(`  await claude('Analyze git history', {
    tools: ['Bash(git:*)', 'Read(**/*.ts)']
  })`);
console.log('\nTools can be restricted using Claude\'s pattern syntax.');
console.log();

// 9. MCP Configuration
console.log('9️⃣ MCP Configuration');
console.log('--------------------');
console.log('Code:');
console.log(`  await claude('Use custom tool', {
    mcpConfig: 'mcp-servers.json',
    tools: ['mcp__custom__action']
  })`);
console.log('\nMCP servers extend Claude with custom tools.');
console.log();

// 10. Prompt File Structure
console.log('🔟 Prompt File Structure');
console.log('-----------------------');
console.log('Example analyze.md:');
console.log(`---
tools: [Read, Write]
system: Be concise
---

# Analyze Task {taskId}

Priority: {priority || 'normal'}

{#if includeDetails}
Include full analysis
{#endif}`);
console.log('\nFrontmatter configures the prompt, body uses variables.');
console.log();

console.log('✅ Demo completed!');
console.log('\nThis demo showed ChannelCoder\'s function-based API.');
console.log('To execute prompts, you need Claude CLI installed.');
console.log('\nRun examples with: bun run example:quick');