import { buildApplication, buildRouteMap } from '@stricli/core';
import pkg from '../../package.json' assert { type: 'json' };
import { interactiveCommand } from './commands/interactive.js';
import { runCommand } from './commands/run.js';
import { sessionCommand } from './commands/session/index.js';
import { streamCommand } from './commands/stream.js';
import { worktreeCommand } from './commands/worktree/index.js';

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
