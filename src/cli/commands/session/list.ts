import { buildCommand, type CommandContext } from '@stricli/core';
import { session } from '../../../session.js';
import { globalFlags, formatFlag } from '../../flags/index.js';
import { formatSessionList } from '../../utils.js';

export const listCommand = buildCommand({
  docs: {
    brief: 'List all saved sessions',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [],
    },
    flags: {
      ...globalFlags,
      format: formatFlag,
    },
  },
  async func(this: CommandContext, flags: { format?: 'table' | 'json' | 'simple'; verbose?: boolean }) {
    const sessions = await session.list();
    this.process.stdout.write(formatSessionList(sessions, flags.format));
  },
});