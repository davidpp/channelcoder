#!/usr/bin/env bun

/**
 * Example: Automated Release Analysis Script
 * 
 * This script demonstrates how to use ChannelCoder for automating
 * release version analysis by passing multiple variables to a prompt.
 */

import { cc } from 'channelcoder';
import { z } from 'zod';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Define the expected output schema
const ReleaseAnalysisSchema = z.object({
  success: z.boolean(),
  recommendedVersion: z.string(),
  changeType: z.enum(['major', 'minor', 'patch']),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
  breakingChanges: z.boolean(),
  highlights: z.array(z.string())
});

/**
 * Get the last git tag (or a default)
 */
function getLastTag(): string {
  try {
    const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    return tags[0] || 'v0.0.0';
  } catch {
    return 'v0.0.0';
  }
}

/**
 * Get commits since the last tag
 */
function getCommitsSince(tag: string): string {
  try {
    const commits = execSync(
      `git log --oneline ${tag}..HEAD --pretty=format:"%h %s"`,
      { encoding: 'utf-8' }
    );
    return commits || 'No commits since last release';
  } catch {
    return 'Unable to fetch commits';
  }
}

/**
 * Get file change summary
 */
function getFileChanges(tag: string): string {
  try {
    const changes = execSync(
      `git diff ${tag}..HEAD --stat`,
      { encoding: 'utf-8' }
    );
    return changes || 'No file changes';
  } catch {
    return 'Unable to fetch file changes';
  }
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main() {
  console.log('🚀 Release Analysis Example\n');

  // Gather git information
  const currentVersion = getCurrentVersion();
  const lastTag = getLastTag();
  const commits = getCommitsSince(lastTag);
  const fileChanges = getFileChanges(lastTag);

  console.log(`📊 Current version: ${currentVersion}`);
  console.log(`🏷️  Last tag: ${lastTag}`);
  console.log(`📝 Analyzing ${commits.split('\n').length} commits...\n`);

  try {
    // Method 1: Using file-based prompt with validation
    console.log('🔍 Running release analysis...\n');
    
    const result = await cc.fromFile('examples/release-analysis.md', {
      currentVersion,
      lastTag,
      commits,
      fileChanges,
      // Optional: provide a target version to validate
      targetVersion: process.argv[2]
    });

    if (!result.success) {
      console.error('❌ Analysis failed:', result.error);
      process.exit(1);
    }

    // Validate the response
    const validation = cc.validate(result, ReleaseAnalysisSchema);
    if (!validation.success) {
      console.error('❌ Invalid response format:', validation.error);
      process.exit(1);
    }

    // Display results
    const analysis = validation.data;
    console.log('✅ Analysis Complete!\n');
    console.log(`📌 Recommended Version: ${analysis.recommendedVersion}`);
    console.log(`📊 Change Type: ${analysis.changeType.toUpperCase()}`);
    console.log(`🎯 Confidence: ${analysis.confidence.toUpperCase()}`);
    console.log(`💥 Breaking Changes: ${analysis.breakingChanges ? 'YES ⚠️' : 'No'}`);
    console.log(`\n💡 Reasoning: ${analysis.reasoning}`);
    
    if (analysis.highlights.length > 0) {
      console.log('\n🌟 Highlights:');
      analysis.highlights.forEach(h => console.log(`   - ${h}`));
    }

    // Method 2: Alternative using inline prompt (for demonstration)
    console.log('\n\n--- Alternative: Using inline prompt ---\n');
    
    const inlineResult = await cc.prompt`
      Analyze these commits for version bump:
      Current: ${currentVersion}
      Commits: ${commits.split('\n').slice(0, 5).join('\n')}
      
      Suggest: major, minor, or patch?
    `
      .withSystemPrompt('Be concise. Respond with just the version type.')
      .run();

    if (inlineResult.success && inlineResult.stdout) {
      console.log(`Quick suggestion: ${inlineResult.stdout.trim()}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}