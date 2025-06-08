import type { CommandContext } from '@stricli/core';

/**
 * Build context for CLI commands
 */
export function buildContext(process: NodeJS.Process): CommandContext {
  return {
    process: {
      stdout: process.stdout,
      stderr: process.stderr,
      exitCode: 0,
    },
  };
}
