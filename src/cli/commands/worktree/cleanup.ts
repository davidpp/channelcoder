import { buildCommand, type CommandContext } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags } from '../../flags/index.js';

export const cleanupCommand = buildCommand({
  docs: {
    brief: 'Clean up temporary worktrees',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [],
    },
    flags: globalFlags,
  },
  async func(this: CommandContext, flags: { verbose?: boolean }) {
    try {
      await worktreeUtils.cleanup();
      this.process.stdout.write('Cleaned up temporary worktrees\n');
    } catch (error) {
      this.process.stderr.write(`Error cleaning up worktrees: ${(error as Error).message}\n`);
      this.process.exitCode = 1;
    }
  },
});