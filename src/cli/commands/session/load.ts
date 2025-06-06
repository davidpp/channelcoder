import { buildCommand, type CommandContext } from '@stricli/core';
import { session } from '../../../session.js';
import { globalFlags } from '../../flags/index.js';

export const loadCommand = buildCommand({
  docs: {
    brief: 'Load and continue an existing session',
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Session name to load',
          parse: String,
        },
      ],
    },
    flags: globalFlags,
  },
  async func(this: CommandContext, flags: { verbose?: boolean }, name: string) {
    const s = await session.load(name);

    // Launch interactive mode with loaded session
    await s.interactive('', {
      verbose: flags.verbose,
    });
  },
});