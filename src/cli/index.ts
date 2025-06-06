import { buildApplication, buildRouteMap } from '@stricli/core';
import { runCommand } from './commands/run.js';
import { sessionCommand } from './commands/session/index.js';
import { worktreeCommand } from './commands/worktree/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get package.json info
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const routes = buildRouteMap({
  routes: {
    session: sessionCommand,
    worktree: worktreeCommand,
  },
  defaultCommand: runCommand,
  docs: {
    brief: packageJson.description || 'Channel your prompts to Claude Code',
  },
});

export const app = buildApplication(routes, {
  name: packageJson.name,
  versionInfo: {
    currentVersion: packageJson.version,
  },
});