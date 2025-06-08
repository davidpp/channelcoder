import { type CommandContext, type TypedFlagParameter, buildCommand } from '@stricli/core';
import { worktreeUtils } from '../../../worktree/index.js';
import { globalFlags } from '../../flags/index.js';

export const createCommand = buildCommand({
  docs: {
    brief: 'Create a new git worktree',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch name for the worktree',
          parse: String,
        },
      ],
    },
    flags: {
      ...globalFlags,
      base: {
        kind: 'parsed' as const,
        parse: (value: string) => value,
        brief: 'Base branch for new worktree',
      } satisfies TypedFlagParameter<string>,
      path: {
        kind: 'parsed' as const,
        parse: (value: string) => value,
        brief: 'Custom path for worktree',
      } satisfies TypedFlagParameter<string>,
    },
  },
  async func(
    this: CommandContext,
    flags: { base?: string; path?: string; verbose?: boolean },
    branch: string
  ) {
    try {
      const worktree = await worktreeUtils.create(branch, {
        base: flags.base,
        path: flags.path,
      });

      this.process.stdout.write('Created worktree:\n');
      this.process.stdout.write(`  Branch: ${worktree.branch}\n`);
      this.process.stdout.write(`  Path: ${worktree.path}\n`);
      if (worktree.autoCreated) {
        this.process.stdout.write(
          `  Note: Branch was created from ${flags.base || 'current branch'}\n`
        );
      }
    } catch (error) {
      this.process.stderr.write(`Error creating worktree: ${(error as Error).message}\n`);
      this.process.exitCode = 1;
    }
  },
});
