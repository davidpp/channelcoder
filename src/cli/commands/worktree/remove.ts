import { type CommandContext, buildCommand } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags } from '../../flags/index.js';

export const removeCommand = buildCommand({
  docs: {
    brief: 'Remove a git worktree',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch name or path of worktree to remove',
          parse: String,
        },
      ],
    },
    flags: globalFlags,
  },
  async func(this: CommandContext, flags: { verbose?: boolean }, branch: string) {
    try {
      await worktreeUtils.remove(branch);
      this.process.stdout.write(`Removed worktree: ${branch}\n`);
    } catch (error) {
      this.process.stderr.write(`Error removing worktree: ${(error as Error).message}\n`);
      this.process.exitCode = 1;
    }
  },
});
