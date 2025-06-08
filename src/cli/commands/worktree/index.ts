import { buildRouteMap } from '@stricli/core';
import { cleanupCommand } from './cleanup.js';
import { createCommand } from './create.js';
import { listCommand } from './list.js';
import { removeCommand } from './remove.js';

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
