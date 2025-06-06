import { buildApplication, buildRouteMap } from '@stricli/core';
import { runCommand } from './commands/run.js';
import { sessionCommand } from './commands/session/index.js';
import { worktreeCommand } from './commands/worktree/index.js';

const routes = buildRouteMap({
  routes: {
    session: sessionCommand,
    worktree: worktreeCommand,
  },
  defaultCommand: runCommand,
  docs: {
    brief: 'A streamlined SDK and CLI for Claude Code - Channel your prompts to Claude',
  },
});

export const app = buildApplication(routes, {
  name: 'channelcoder',
  versionInfo: {
    currentVersion: '2.6.0',
  },
});