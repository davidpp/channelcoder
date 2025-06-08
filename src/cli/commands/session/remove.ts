import { homedir } from 'os';
import { join } from 'path';
import { type CommandContext, buildCommand } from '@stricli/core';
import { unlink } from 'fs/promises';
import { globalFlags } from '../../flags/index.js';

export const removeCommand = buildCommand({
  docs: {
    brief: 'Remove a saved session',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Session name to remove',
          parse: String,
        },
      ],
    },
    flags: globalFlags,
  },
  async func(this: CommandContext, flags: { verbose?: boolean }, name: string) {
    const sessionPath = join(homedir(), '.channelcoder', 'sessions', name);

    try {
      await unlink(sessionPath);
      this.process.stdout.write(`Removed session: ${name}\n`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.process.stderr.write(`Session not found: ${name}\n`);
        this.process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});
