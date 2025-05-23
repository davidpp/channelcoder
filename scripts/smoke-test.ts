#!/usr/bin/env bun

/**
 * E2E Smoke test for CLI functionality
 * This test actually calls Claude API to verify the full flow works
 */

import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Colors for output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

function runCommand(cmd: string) {
  console.log(`\n${blue}$ ${cmd}${reset}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    return true;
  } catch (_error) {
    return false;
  }
}

function log(message: string) {
  console.log(`${yellow}→ ${message}${reset}`);
}

function success(message: string) {
  console.log(`${green}✓ ${message}${reset}`);
}

function error(message: string) {
  console.log(`${red}✗ ${message}${reset}`);
}

async function main() {
  console.log(`${yellow}🚬 Running E2E CLI smoke tests...${reset}\n`);
  console.log(`${blue}These tests will make real Claude API calls${reset}\n`);

  let hasErrors = false;

  // Test 1: Build the project
  log('Building the project...');
  if (!runCommand('bun run build')) {
    error('Build failed!');
    process.exit(1);
  }
  success('Build completed');

  // Test 2: Basic help (no API call)
  log('Testing help command...');
  if (!runCommand('node dist/cli.cjs --help')) {
    error('Help command failed!');
    hasErrors = true;
  } else {
    success('Help command works');
  }

  // Test 3: E2E test with inline prompt and interpolation
  log('Testing E2E: inline prompt with variable interpolation...');
  console.log(`${blue}This will call Claude API to test the full flow${reset}`);

  if (
    !runCommand(
      'node dist/cli.cjs -p "Complete this sentence in exactly 5 words: The value is {testValue}" -d testValue=forty-two --verbose'
    )
  ) {
    error('E2E inline prompt test failed!');
    hasErrors = true;
  } else {
    success('E2E inline prompt with interpolation works!');
  }

  // Test 4: E2E test with markdown file
  log('Testing E2E: markdown file with frontmatter and interpolation...');
  const tmpDir = mkdtempSync(join(tmpdir(), 'cc-smoke-'));
  const promptFile = join(tmpDir, 'test-prompt.md');

  try {
    // Create a test prompt file with frontmatter
    writeFileSync(
      promptFile,
      `---
systemPrompt: "You are a helpful assistant. Be very concise."
allowedTools: ["Read", "Write"]
---

# Task: {taskName}

Please respond with exactly one word that describes the number {number}.

The number is: {number}`
    );

    console.log(`${blue}Created test file: ${promptFile}${reset}`);
    console.log(`${blue}This will parse .md frontmatter and call Claude API${reset}`);

    if (
      !runCommand(
        `node dist/cli.cjs "${promptFile}" -d taskName="Number Description" -d number=7 --verbose`
      )
    ) {
      error('E2E markdown file test failed!');
      hasErrors = true;
    } else {
      success('E2E markdown file parsing and execution works!');
    }
  } finally {
    rmSync(tmpDir, { recursive: true });
    success('Cleaned up test files');
  }

  // Test 5: E2E test with streaming
  log('Testing E2E: streaming response...');
  console.log(`${blue}Testing streaming output from Claude${reset}`);

  if (!runCommand('node dist/cli.cjs -p "Count from 1 to 5, one number per line" --stream')) {
    error('E2E streaming test failed!');
    hasErrors = true;
  } else {
    success('E2E streaming works!');
  }

  // Test 6: Test JSON output format
  log('Testing JSON output format...');
  console.log(`${blue}Testing --json flag for programmatic usage${reset}`);

  if (!runCommand('node dist/cli.cjs -p "Return the word: success" --json')) {
    error('JSON output format test failed!');
    hasErrors = true;
  } else {
    success('JSON output format works');
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  if (hasErrors) {
    console.log(`${red}❌ Some E2E smoke tests failed!${reset}`);
    console.log(`${yellow}⚠️  Fix the issues before publishing to npm.${reset}\n`);
    process.exit(1);
  } else {
    console.log(`${green}✅ All E2E smoke tests passed!${reset}`);
    console.log(`${green}📦 Package is ready for npm publish.${reset}`);
    console.log(`${green}✨ Successfully tested:${reset}`);
    console.log('  - CLI loads and shows help');
    console.log('  - Variable interpolation works ({var} syntax)');
    console.log('  - Markdown file parsing with frontmatter');
    console.log('  - Real Claude API calls');
    console.log('  - Streaming responses');
    console.log('  - JSON output format');
    console.log('');
  }
}

main().catch((error) => {
  console.error(`${red}Fatal error:${reset}`, error);
  process.exit(1);
});
