import { buildApplication, buildRouteMap } from '@stricli/core';
import { runCommand } from './commands/run.js';
import { interactiveCommand } from './commands/interactive.js';
import { streamCommand } from './commands/stream.js';
import { sessionCommand } from './commands/session/index.js';
import { worktreeCommand } from './commands/worktree/index.js';
import pkg from '../../package.json' assert { type: 'json' };

const routes = buildRouteMap({
  routes: {
    run: runCommand,
    interactive: interactiveCommand,
    stream: streamCommand,
    session: sessionCommand,
    worktree: worktreeCommand,
  },
  aliases: {
    i: 'interactive',
  },
  defaultCommand: 'interactive',
  docs: {
    brief: 'A streamlined SDK and CLI for Claude Code - Channel your prompts to Claude',
  },
});

export const app = buildApplication(routes, {
  name: pkg.name,
  versionInfo: {
    currentVersion: pkg.version,
  },
});