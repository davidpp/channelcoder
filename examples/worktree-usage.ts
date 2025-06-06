#!/usr/bin/env bun
/**
 * Example: Git Worktree Management with ChannelCoder
 * 
 * This example demonstrates the different ways to use worktrees with ChannelCoder,
 * from simple usage to advanced multi-worktree workflows.
 */

import { claude, worktree, worktreeUtils } from '../src/index.js';

// Example 1: Simple worktree usage with option-based integration
async function simpleWorktreeExample() {
  console.log('=== Simple Worktree Example ===');
  
  // Basic usage - auto-creates worktree if it doesn't exist
  const result = await claude('Analyze the codebase structure', {
    worktree: 'feature/analysis',
    dryRun: true // Use dry run to see the command without executing
  });
  
  console.log('Command that would be executed:', result.data?.fullCommand);
}

// Example 2: Standalone worktree function usage
async function standaloneWorktreeExample() {
  console.log('\n=== Standalone Worktree Function Example ===');
  
  try {
    await worktree('feature/auth', async (wt) => {
      console.log(`Working in worktree: ${wt.branch}`);
      console.log(`Worktree path: ${wt.path}`);
      console.log(`Auto-created: ${wt.autoCreated}`);
      
      // Multiple operations in the same worktree context
      await claude('Plan OAuth implementation', { dryRun: true });
      await claude('Generate OAuth components', { dryRun: true });
      
      return wt.branch; // Return value from worktree function
    }, {
      base: 'main',
      cleanup: false // Keep worktree after execution
    });
  } catch (error) {
    console.log('Worktree operation would execute (dry run mode)');
  }
}

// Example 3: Utility functions for worktree management
async function utilityFunctionsExample() {
  console.log('\n=== Utility Functions Example ===');
  
  try {
    // List all existing worktrees
    const worktrees = await worktreeUtils.list();
    console.log('Existing worktrees:', worktrees.map(wt => `${wt.branch} -> ${wt.path}`));
    
    // Check if a specific worktree exists
    const exists = await worktreeUtils.exists('feature/auth');
    console.log('Auth feature worktree exists:', exists);
    
    // Get current worktree (if in one)
    const current = await worktreeUtils.current();
    if (current) {
      console.log(`Currently in worktree: ${current.branch}`);
    } else {
      console.log('Not currently in a worktree');
    }
    
    // Create a new worktree manually
    // await worktreeUtils.create('experiment/new-approach', { base: 'main' });
    
    // Cleanup auto-created worktrees (dry run)
    const toCleanup = await worktreeUtils.cleanup(true);
    console.log('Would cleanup these worktrees:', toCleanup);
    
  } catch (error) {
    console.log('Note: These operations would work in a real git repository');
  }
}

// Example 4: Complex multi-worktree workflow
async function multiWorktreeWorkflow() {
  console.log('\n=== Multi-Worktree Workflow Example ===');
  
  const features = ['auth', 'payments', 'notifications'];
  const results = [];
  
  for (const feature of features) {
    try {
      const result = await worktree(`feature/${feature}`, async (wt) => {
        console.log(`Planning ${feature} feature in ${wt.path}`);
        
        // Simulate feature planning
        const planResult = await claude(`Plan ${feature} feature implementation`, {
          dryRun: true
        });
        
        return {
          feature,
          branch: wt.branch,
          planned: true
        };
      }, {
        base: 'main',
        cleanup: false
      });
      
      results.push(result);
    } catch (error) {
      console.log(`Would plan ${feature} feature (dry run mode)`);
      results.push({ feature, planned: true });
    }
  }
  
  console.log('Multi-worktree planning results:', results);
}

// Example 5: Worktree + Docker composition
async function worktreeDockerExample() {
  console.log('\n=== Worktree + Docker Composition Example ===');
  
  try {
    await worktree('experiment/risky-change', async (wt) => {
      console.log(`Testing risky changes in isolated worktree: ${wt.path}`);
      
      // Run in both worktree AND Docker for maximum isolation
      const result = await claude('Test experimental changes', {
        docker: true, // Also run in Docker container
        tools: ['Bash(npm:*)', 'Read', 'Write'],
        dryRun: true
      });
      
      console.log('Would execute in worktree + Docker:', result.data?.fullCommand);
      
      return 'experiment-complete';
    }, {
      cleanup: true // Clean up the experimental worktree
    });
  } catch (error) {
    console.log('Worktree + Docker composition would work in real environment');
  }
}

// Run all examples
async function main() {
  console.log('ChannelCoder Worktree Examples');
  console.log('==============================');
  
  await simpleWorktreeExample();
  await standaloneWorktreeExample();
  await utilityFunctionsExample();
  await multiWorktreeWorkflow();
  await worktreeDockerExample();
  
  console.log('\n✅ All examples completed!');
  console.log('\nNote: These examples use dry-run mode to show commands without execution.');
  console.log('In a real git repository, remove dryRun: true to actually create worktrees.');
}

if (import.meta.main) {
  main().catch(console.error);
}