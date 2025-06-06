import { buildCommand, type CommandContext } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags, formatFlag } from '../../flags/index.js';
import { formatWorktreeList } from '../../utils.js';

export const listCommand = buildCommand({
  docs: {
    brief: 'List all git worktrees',
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
    try {
      const worktrees = await worktreeUtils.list();
      this.process.stdout.write(formatWorktreeList(worktrees, flags.format));
    } catch (error) {
      this.process.stderr.write(`Error listing worktrees: ${(error as Error).message}\n`);
      this.process.exitCode = 1;
    }
  },
});