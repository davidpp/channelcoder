import { buildRouteMap } from '@stricli/core';
import { listCommand } from './list.js';
import { loadCommand } from './load.js';
import { removeCommand } from './remove.js';

export const sessionCommand = buildRouteMap({
  docs: {
    brief: 'Manage Claude sessions',
  },
  routes: {
    list: listCommand,
    load: loadCommand,
    remove: removeCommand,
  },
});