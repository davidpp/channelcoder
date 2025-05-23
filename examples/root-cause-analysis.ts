#!/usr/bin/env bun

/**
 * Example: Root Cause Analysis Tool
 *
 * Demonstrates using ChannelCoder to debug issues by systematically
 * tracing through codebases to find root causes of errors.
 */

import { cc } from 'channelcoder';
import { z } from 'zod';

// Define the analysis output schema
const RootCauseAnalysisSchema = z.object({
  success: z.boolean(),
  rootCause: z.object({
    file: z.string(),
    line: z.number(),
    description: z.string(),
  }),
  callTrace: z.array(
    z.object({
      file: z.string(),
      function: z.string(),
      line: z.number(),
    })
  ),
  hypothesis: z.string(),
  suggestedFix: z.string(),
  relatedFiles: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * Example error scenarios to analyze
 */
const ERROR_SCENARIOS = {
  typeError: {
    errorMessage: "TypeError: Cannot read property 'name' of undefined",
    stackTrace: `TypeError: Cannot read property 'name' of undefined
    at UserService.formatUserDisplay (src/services/user.service.ts:45:23)
    at UserController.getUser (src/controllers/user.controller.ts:28:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    searchPattern: "formatUserDisplay|property 'name'",
    suspectedFile: 'src/services/user.service.ts',
    contextInfo: 'Error occurs when fetching user profile',
  },

  asyncError: {
    errorMessage: 'UnhandledPromiseRejectionWarning: Connection timeout',
    searchPattern: 'Connection timeout|database connection|connect',
    contextInfo: 'Happens intermittently under high load',
  },

  importError: {
    errorMessage: "Module not found: Error: Can't resolve './config'",
    stackTrace: `Module not found: Error: Can't resolve './config' in '/app/src/utils'`,
    searchPattern: 'import.*config|require.*config',
    suspectedFile: 'src/utils/index.ts',
  },
};

async function analyzeError(scenario: keyof typeof ERROR_SCENARIOS) {
  const errorData = ERROR_SCENARIOS[scenario];

  console.log(`\n🔍 Analyzing: ${errorData.errorMessage}\n`);
  console.log('📋 Running root cause analysis...\n');

  try {
    // Perform the analysis using our prompt template
    const result = await cc.fromFile('examples/root-cause-analysis.md', errorData);

    if (!result.success) {
      console.error('❌ Analysis failed:', result.error);
      return;
    }

    // Validate the response
    const validation = cc.validate(result, RootCauseAnalysisSchema);
    if (!validation.success) {
      console.error('❌ Invalid response format:', validation.error);
      // Still try to show raw output
      if (result.stdout) {
        console.log('\nRaw output:', result.stdout);
      }
      return;
    }

    // Display the analysis results
    const analysis = validation.data;

    console.log('✅ Root Cause Analysis Complete!\n');
    console.log('📍 Root Cause Location:');
    console.log(`   File: ${analysis.rootCause.file}`);
    console.log(`   Line: ${analysis.rootCause.line}`);
    console.log(`   Issue: ${analysis.rootCause.description}\n`);

    console.log('🔄 Call Trace:');
    analysis.callTrace.forEach((trace, idx) => {
      console.log(`   ${idx + 1}. ${trace.function} at ${trace.file}:${trace.line}`);
    });

    console.log('\n💡 Hypothesis:');
    console.log(`   ${analysis.hypothesis}`);

    console.log('\n🔧 Suggested Fix:');
    console.log(`   ${analysis.suggestedFix}`);

    if (analysis.relatedFiles.length > 0) {
      console.log('\n📁 Related Files:');
      analysis.relatedFiles.forEach((file) => console.log(`   - ${file}`));
    }

    console.log(`\n🎯 Confidence: ${analysis.confidence.toUpperCase()}`);
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

/**
 * Interactive mode - analyze custom errors
 */
async function analyzeCustomError() {
  console.log('\n📝 Custom Error Analysis\n');

  // In a real scenario, you might read these from command line args or a file
  const customError = {
    errorMessage: process.argv[2] || 'Error: Custom error message',
    searchPattern: process.argv[3] || 'error|Error|throw',
    contextInfo: 'User-provided error for analysis',
  };

  console.log(`Analyzing: ${customError.errorMessage}`);

  const result = await cc.fromFile('examples/root-cause-analysis.md', customError);

  if (result.success && result.stdout) {
    console.log('\nAnalysis Result:');
    console.log(result.stdout);
  } else {
    console.error('Analysis failed:', result.error);
  }
}

/**
 * Demonstrate using inline prompt for quick investigations
 */
async function quickSearch(pattern: string) {
  console.log(`\n🔎 Quick Search for: "${pattern}"\n`);

  const result = await cc.prompt`
    Search the codebase for pattern: ${pattern}
    
    1. Use ripgrep (rg) to find all occurrences
    2. Show the file paths and line numbers
    3. For each match, show 2 lines of context
    
    Limit results to 10 most relevant matches.
  `
    .withTools(['Bash(rg:*)', 'Read'])
    .run();

  if (result.success && result.stdout) {
    console.log('Search Results:');
    console.log(result.stdout);
  }
}

// Main function
async function main() {
  console.log('🔬 Root Cause Analysis Examples\n');
  console.log('This example demonstrates systematic debugging using ChannelCoder.\n');

  const args = process.argv.slice(2);

  if (args[0] === '--custom') {
    // Analyze custom error
    await analyzeCustomError();
  } else if (args[0] === '--search') {
    // Quick search mode
    const pattern = args[1] || 'TODO';
    await quickSearch(pattern);
  } else {
    // Demo mode - analyze example scenarios
    console.log('Running example scenarios...\n');
    console.log('=' * 60);

    // Analyze different error types
    await analyzeError('typeError');

    console.log(`\n${'=' * 60}`);
    await analyzeError('importError');

    console.log('\n💡 Tips:');
    console.log('  - Run with --custom "error message" "search pattern"');
    console.log('  - Run with --search "pattern" for quick code search');
    console.log('  - The analysis uses read-only tools for safety');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
