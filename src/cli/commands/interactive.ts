import { buildCommand, type CommandContext } from '@stricli/core';
import { interactive } from '../../index.js';
import {
  globalFlags,
  dataFlags,
  systemFlags,
  toolFlags,
  sessionFlags,
  dockerFlags,
  worktreeFlags,
  mcpFlags,
  executionFlags,
} from '../flags/index.js';
import { parseDataArgs, readStdinJson, parseTools, parseDockerEnv } from '../utils.js';
import type { ClaudeOptions, DockerOptions, WorktreeOptions } from '../../types.js';

interface InteractiveFlags {
  // Data
  data?: string[];
  dataStdin?: boolean;

  // System
  system?: string;
  appendSystem?: string;

  // Tools
  tools?: string;
  disallowedTools?: string;

  // MCP
  mcpConfig?: string;
  permissionTool?: string;

  // Session
  resume?: string;
  continue?: boolean;
  session?: string;
  loadSession?: string;

  // Execution
  maxTurns?: number;
  dangerouslySkipPermissions?: boolean;
  verbose?: boolean;

  // Docker
  docker?: boolean;
  dockerImage?: string;
  dockerMount?: string[];
  dockerEnv?: string[];

  // Worktree
  worktree?: string;
  worktreeBase?: string;
  worktreeKeep?: boolean;
}

/**
 * Parse data from flags
 */
async function parseData(flags: InteractiveFlags): Promise<Record<string, any>> {
  let data = {};

  if (flags.dataStdin) {
    data = await readStdinJson();
  }

  if (flags.data) {
    const cliData = await parseDataArgs(flags.data);
    data = { ...data, ...cliData };
  }

  return data;
}

/**
 * Build Docker options from flags
 */
function buildDockerOptions(flags: InteractiveFlags): boolean | DockerOptions | undefined {
  if (!flags.docker && !flags.dockerImage) {
    return undefined;
  }

  if (flags.dockerImage) {
    return {
      image: flags.dockerImage,
      mounts: flags.dockerMount || [],
      env: flags.dockerEnv ? parseDockerEnv(flags.dockerEnv) : {},
    };
  }

  // Simple docker mode
  if (flags.dockerMount || flags.dockerEnv) {
    return {
      auto: true,
      mounts: flags.dockerMount || [],
      env: flags.dockerEnv ? parseDockerEnv(flags.dockerEnv) : {},
    };
  }

  return true;
}

/**
 * Build worktree options from flags
 */
function buildWorktreeOptions(flags: InteractiveFlags): WorktreeOptions | undefined {
  if (!flags.worktree) {
    return undefined;
  }

  return {
    branch: flags.worktree,
    base: flags.worktreeBase,
    cleanup: !flags.worktreeKeep,
  };
}

/**
 * Build Claude options from flags
 */
function buildOptions(flags: InteractiveFlags, data: Record<string, any>): Partial<ClaudeOptions> {
  const options: Partial<ClaudeOptions> = {};

  // Data
  if (Object.keys(data).length > 0) {
    options.data = data;
  }

  // System prompts
  if (flags.system) options.system = flags.system;
  if (flags.appendSystem) options.appendSystem = flags.appendSystem;

  // Tools
  if (flags.tools) options.tools = parseTools(flags.tools);
  if (flags.disallowedTools) options.disallowedTools = parseTools(flags.disallowedTools);

  // MCP
  if (flags.mcpConfig) options.mcpConfig = flags.mcpConfig;
  if (flags.permissionTool) options.permissionTool = flags.permissionTool;

  // Session
  if (flags.resume) options.resume = flags.resume;
  if (flags.continue) options.continue = true;

  // Execution
  if (flags.maxTurns !== undefined) options.maxTurns = flags.maxTurns;
  if (flags.dangerouslySkipPermissions) options.dangerouslySkipPermissions = true;
  if (flags.verbose) options.verbose = true;

  // Docker
  const dockerOptions = buildDockerOptions(flags);
  if (dockerOptions !== undefined) {
    options.docker = dockerOptions;
  }

  // Worktree
  const worktreeOptions = buildWorktreeOptions(flags);
  if (worktreeOptions) {
    options.worktree = worktreeOptions;
  }

  return options;
}

/**
 * Handle session mode execution
 */
async function executeWithSession(
  flags: InteractiveFlags,
  promptSource: string,
  options: Partial<ClaudeOptions>
): Promise<void> {
  const { session } = await import('../../session.js');

  const s = flags.loadSession
    ? await session.load(flags.loadSession)
    : session({ name: flags.session });

  await s.interactive(promptSource, options);

  if (flags.session) {
    await s.save(flags.session);
  }
}

export const interactiveCommand = buildCommand({
  docs: {
    brief: 'Launch interactive Claude UI',
    customUsage: [
      '"Help me debug this"',
      'refactor.md -d file=index.ts',
      '--session feature-work --docker',
    ],
  },
  async func(this: CommandContext, flags: InteractiveFlags, promptFile?: string) {
    // Parse data
    const data = await parseData(flags);

    // Build options
    const options = buildOptions(flags, data);

    // Determine prompt source from positional argument
    const promptSource = promptFile || '';

    // Handle session mode
    if (flags.session || flags.loadSession) {
      await executeWithSession(flags, promptSource, options);
      return;
    }

    // Launch interactive mode
    await interactive(promptSource, options);
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Prompt text or file path',
          parse: String,
          optional: true,
        },
      ],
    },
    flags: {
      ...globalFlags,
      ...dataFlags,
      ...systemFlags,
      ...toolFlags,
      ...sessionFlags,
      ...dockerFlags,
      ...worktreeFlags,
      ...mcpFlags,
      ...executionFlags,
    },
    aliases: {
      // Data aliases
      d: 'data',
      // System aliases
      s: 'system',
      // Tool aliases
      t: 'tools',
      // Session aliases
      r: 'resume',
      c: 'continue',
      // Global aliases
      v: 'verbose',
      // Worktree aliases
      w: 'worktree',
    },
  },
});