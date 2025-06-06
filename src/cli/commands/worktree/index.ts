import { buildRouteMap } from '@stricli/core';
import { listCommand } from './list.js';
import { createCommand } from './create.js';
import { removeCommand } from './remove.js';
import { cleanupCommand } from './cleanup.js';

export const worktreeCommand = buildRouteMap({
  docs: {
    brief: 'Manage git worktrees',
  },
  routes: {
    list: listCommand,
    create: createCommand,
    remove: removeCommand,
    cleanup: cleanupCommand,
  },
});