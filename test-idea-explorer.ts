#!/usr/bin/env bun

import * as path from 'path';
import * as fs from 'fs/promises';

const STATE_DIR = '.idea-explorer';
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Add some test ideas to the queue
async function addTestIdeas() {
  await fs.mkdir(STATE_DIR, { recursive: true });

  const ideas = [
    {
      title: 'OAuth-Integration',
      description: 'Add GitHub and Google OAuth support to the application',
    },
    {
      title: 'Dark-Mode',
      description: 'Implement theme switching with CSS variables and user preference persistence',
    },
    {
      title: 'Real-time-Updates',
      description: 'Add WebSocket support for live notifications and data updates',
    },
    {
      title: 'API-Rate-Limiting',
      description: 'Implement rate limiting with Redis to prevent API abuse',
    },
    {
      title: 'Search-Feature',
      description: 'Add full-text search using PostgreSQL or Elasticsearch',
    },
  ];

  const queue = ideas.map((idea, i) => ({
    id: `idea-test-${Date.now()}-${i}`,
    title: idea.title,
    description: idea.description,
    status: 'queued' as const,
  }));

  const state = {
    queue,
    parallelism: 3,
  };

  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`✅ Added ${ideas.length} test ideas to the queue`);
  console.log('\nNow run: bun run examples/idea-explorer-simple.ts');
  console.log('You should see the ideas being processed in parallel!');
}

// Check current state
async function checkState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(data);

    console.log('\n📊 Current State:');
    console.log(`- Total jobs: ${state.queue.length}`);
    console.log(`- Queued: ${state.queue.filter((j) => j.status === 'queued').length}`);
    console.log(`- Running: ${state.queue.filter((j) => j.status === 'running').length}`);
    console.log(`- Completed: ${state.queue.filter((j) => j.status === 'completed').length}`);
    console.log(`- Parallelism: ${state.parallelism}`);

    console.log('\n📋 Jobs:');
    for (const job of state.queue) {
      console.log(`  ${job.status.padEnd(10)} ${job.title}`);
    }
  } catch {
    console.log('No state file found. Run the explorer first.');
  }
}

// Main
const command = process.argv[2];

if (command === 'add') {
  await addTestIdeas();
} else if (command === 'check') {
  await checkState();
} else {
  console.log('Usage:');
  console.log('  bun run test-idea-explorer.ts add    - Add test ideas');
  console.log('  bun run test-idea-explorer.ts check  - Check current state');
}
