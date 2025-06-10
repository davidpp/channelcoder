import { execSync, spawnSync } from 'node:child_process';
import { DockerManager } from './docker.js';
import { loadPromptFile } from './loader.js';
import { CCProcess } from './process.js';
import { PromptTemplate } from './template.js';
import type {
  CCOptions,
  CCResult,
  DockerOptions,
  InterpolationData,
  InterpolationValue,
  LaunchResult,
  PromptConfig,
  StreamChunk,
} from './types.js';
import { validateInput } from './utils/validation.js';

/**
 * Options for the claude() function, mapping to Claude CLI flags
 */
export interface ClaudeOptions {
  // Data & Prompts
  data?: InterpolationData; // Variable interpolation
  system?: string; // System prompt (inline or .md file)
  appendSystem?: string; // Append to system prompt

  // Tools
  tools?: string[]; // Allowed tools (maps to --tools)
  disallowedTools?: string[]; // Disallowed tools
  mcpConfig?: string; // MCP server config file
  permissionTool?: string; // MCP permission tool

  // Session Management
  resume?: string; // Resume session by ID
  continue?: boolean; // Continue most recent session

  // Execution Control
  maxTurns?: number; // Limit agentic turns
  mode?: 'run' | 'stream' | 'interactive'; // Execution mode
  includeEvents?: boolean; // Include event tracking

  // Other
  verbose?: boolean; // Verbose output
  outputFormat?: 'json' | 'stream-json' | 'text'; // Output format
  timeout?: number; // Timeout in milliseconds
  dryRun?: boolean; // Return command instead of executing
  parse?: boolean; // Parse JSON messages in stream mode (default: false)

  // Process control
  detached?: boolean; // Run in detached mode (background)
  logFile?: string; // Log file path for detached mode output
  stream?: boolean; // Enable streaming output in detached mode

  // Docker execution
  docker?: boolean | DockerOptions; // Run in Docker container

  // Worktree execution
  worktree?: boolean | string | import('./worktree/types.js').WorktreeOptions; // Run in git worktree
}

// Internal: Detect if input is a file path
function isFilePath(input: string): boolean {
  // Must end with .md or start with ./ or ../ or contain path separators with file extension
  return (
    input.endsWith('.md') ||
    input.startsWith('./') ||
    input.startsWith('../') ||
    input.startsWith('/') ||
    /^[A-Za-z]:\\/.test(input) || // Windows absolute path
    /[\\/][^\\/:*?"<>|]+\.[a-zA-Z]+$/.test(input)
  ); // Has path separator and file extension
}

// Internal: Convert ClaudeOptions to CCOptions format
function convertOptions(options: ClaudeOptions): CCOptions & PromptConfig {
  const ccOptions: CCOptions = {
    verbose: options.verbose,
    outputFormat: options.outputFormat || (options.mode === 'interactive' ? undefined : 'json'),
    resume: options.resume,
    continue: options.continue,
    maxTurns: options.maxTurns,
    timeout: options.timeout, // No default timeout
    docker: options.docker,
    worktree: options.worktree,
    mode: options.mode,
    detached: options.detached,
    logFile: options.logFile,
    stream: options.stream,
  };

  const promptConfig: PromptConfig = {};

  // Only add defined values to avoid overwriting frontmatter with undefined
  if (options.system !== undefined) promptConfig.systemPrompt = options.system;
  if (options.appendSystem !== undefined) promptConfig.appendSystemPrompt = options.appendSystem;
  if (options.tools !== undefined) promptConfig.allowedTools = options.tools;
  if (options.disallowedTools !== undefined) promptConfig.disallowedTools = options.disallowedTools;
  if (options.mcpConfig !== undefined) promptConfig.mcpConfig = options.mcpConfig;
  if (options.permissionTool !== undefined)
    promptConfig.permissionPromptTool = options.permissionTool;

  return { ...ccOptions, ...promptConfig };
}

/**
 * Claude function with overloads for template literal support
 */
export interface ClaudeFunction {
  (promptOrFile: string, options?: ClaudeOptions): Promise<CCResult>;
  (strings: TemplateStringsArray, ...values: InterpolationValue[]): Promise<CCResult>;
}

/**
 * Internal implementation
 */
const claudeImpl = async (promptOrFile: string, options: ClaudeOptions = {}): Promise<CCResult> => {
  const template = new PromptTemplate();
  const ccOptions = convertOptions(options);
  const ccProcess = new CCProcess(ccOptions);
  const mode = options.mode || 'run';

  let prompt: string;
  let mergedOptions = ccOptions;

  // Handle file vs inline prompt
  if (isFilePath(promptOrFile)) {
    // File-based prompt
    const { config, content } = await loadPromptFile(promptOrFile);

    // Validate input if schema provided
    if (config.input && options.data) {
      const validationResult = validateInput(config.input, options.data);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Input validation failed: ${validationResult.error}`,
        };
      }
    }

    prompt = template.interpolate(content, options.data || {});

    // Merge file config with options (options override)
    mergedOptions = { ...config, ...mergedOptions };
  } else {
    // Inline prompt
    prompt = template.interpolate(promptOrFile, options.data || {});
  }

  // Handle dry-run mode
  if (options.dryRun) {
    // Handle Docker mode in dry-run
    if (options.docker) {
      const dockerManager = new DockerManager();

      try {
        // Resolve Docker configuration
        const dockerConfig = await dockerManager.resolveDockerConfig(options.docker);

        // Build Docker args
        const dockerArgs = dockerManager.buildDockerArgs(dockerConfig, mode === 'interactive');

        // Build Claude command args
        // For stream mode, ensure output format is stream-json
        const dockerDryRunOptions =
          mode === 'stream'
            ? { ...mergedOptions, outputFormat: 'stream-json' as const }
            : mergedOptions;
        const claudeCmd = await ccProcess.buildCommand(dockerDryRunOptions);
        const claudeArgs = claudeCmd.slice(1); // Remove 'claude' from args

        // Combine Docker and Claude args
        const fullArgs = [...dockerArgs, 'claude', ...claudeArgs];

        // Build the full command
        const baseCommand = ['docker', ...fullArgs]
          .map((arg) => {
            // Escape arguments that contain spaces or special characters
            if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
              return `"${arg.replace(/"/g, '\\"')}"`;
            }
            return arg;
          })
          .join(' ');

        // Create the full command with piped input
        let fullCommand: string;
        if (!mergedOptions.resume && !mergedOptions.continue) {
          // Escape the prompt for shell echo command
          const escapedPrompt = prompt
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/`/g, '\\`')
            .replace(/\n/g, '\\n');

          // Use echo -e to handle newlines properly
          fullCommand = `echo -e "${escapedPrompt}" | ${baseCommand}`;
        } else {
          // For resume/continue, no prompt is needed
          fullCommand = baseCommand;
        }

        return {
          success: true,
          data: {
            command: 'docker',
            args: fullArgs,
            fullCommand,
            prompt, // Include raw prompt for reference
            // Include detached/streaming info for dry-run testing
            ...(options.detached && {
              pid: 12345, // Mock PID for dry-run
              detached: true,
              logFile: options.logFile,
              streaming: options.stream || false,
            }),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Docker configuration error: ${error}`,
        };
      }
    }

    // Non-Docker dry-run
    // For stream mode, ensure output format is stream-json
    const dryRunOptions =
      mode === 'stream'
        ? { ...mergedOptions, outputFormat: 'stream-json' as const }
        : mergedOptions;
    const args = await ccProcess.buildCommand(dryRunOptions);

    // Build the base command
    const baseCommand = args
      .map((arg) => {
        // Escape arguments that contain spaces or special characters
        if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      })
      .join(' ');

    // Create the full command with piped input
    let fullCommand: string;
    if (!mergedOptions.resume && !mergedOptions.continue) {
      // Escape the prompt for shell echo command
      const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/\n/g, '\\n');

      // Use echo -e to handle newlines properly
      fullCommand = `echo -e "${escapedPrompt}" | ${baseCommand}`;
    } else {
      // For resume/continue, no prompt is needed
      fullCommand = baseCommand;
    }

    return {
      success: true,
      data: {
        command: args[0],
        args: args.slice(1),
        fullCommand,
        prompt, // Include raw prompt for reference
        // Include detached/streaming info for dry-run testing
        ...(options.detached && {
          pid: 12345, // Mock PID for dry-run
          detached: true,
          logFile: options.logFile,
          streaming: options.stream || false,
        }),
      },
    };
  }

  // Handle detached mode
  if (options.detached) {
    return ccProcess.executeDetached(prompt, mergedOptions);
  }

  // Execute based on mode
  switch (mode) {
    case 'interactive': {
      const launchResult = await launchInteractive(prompt, mergedOptions);
      return {
        success: launchResult.exitCode === 0,
        error: launchResult.error,
      };
    }

    case 'stream': {
      // Collect stream chunks into result
      const chunks: string[] = [];
      for await (const chunk of ccProcess.stream(prompt, mergedOptions)) {
        chunks.push(chunk.content);
      }
      return {
        success: true,
        data: chunks.join(''),
      };
    }

    default:
      return ccProcess.execute(prompt, mergedOptions);
  }
};

/**
 * Launch Claude interactively (internal helper)
 */
async function launchInteractive(
  prompt: string,
  options: CCOptions & PromptConfig
): Promise<LaunchResult> {
  try {
    // Handle Docker mode for interactive
    if (options.docker) {
      const dockerManager = new DockerManager();

      // Check if Docker is available
      if (!(await dockerManager.checkDockerAvailable())) {
        console.error('Docker not found. Please install Docker to use Docker mode.');
        global.process.exit(1);
      }

      // Resolve Docker configuration
      const dockerConfig = await dockerManager.resolveDockerConfig(options.docker);

      // Build image if needed
      if (dockerConfig.needsBuild && dockerConfig.dockerfilePath) {
        const imageExists = await dockerManager.imageExists(dockerConfig.image);
        if (!imageExists) {
          await dockerManager.buildImage(dockerConfig.dockerfilePath, dockerConfig.image);
        }
      }

      // Build Docker args for interactive mode
      const dockerArgs = dockerManager.buildDockerArgs(dockerConfig, true);

      // Build Claude command args
      const ccProcess = new CCProcess({ ...options, mode: 'interactive' });
      const claudeCmd = await ccProcess.buildCommand({ ...options, mode: 'interactive' });
      const claudeArgs = claudeCmd.slice(1); // Remove 'claude' from args

      // Helper to escape single quotes for shell
      const escapeShell = (str: string) => str.replace(/'/g, "'\\''");

      // Build shell command with Docker
      let shellCommand: string;
      const dockerArgsStr = dockerArgs.map((arg) => `'${escapeShell(arg)}'`).join(' ');
      const claudeArgsStr = claudeArgs.map((arg) => `'${escapeShell(arg)}'`).join(' ');

      if (prompt && !options.resume && !options.continue) {
        // Use exec with echo piped to docker run claude
        const escapedPrompt = escapeShell(prompt);
        shellCommand = `exec echo '${escapedPrompt}' | exec docker ${dockerArgsStr} claude ${claudeArgsStr}`;
      } else {
        // No prompt - just exec docker run claude directly
        shellCommand = `exec docker ${dockerArgsStr} claude ${claudeArgsStr}`;
      }

      // Execute with shell, this replaces the current process
      execSync(shellCommand, {
        stdio: 'inherit',
      });

      // This line will never be reached because exec replaces the process
      return { exitCode: 0 };
    }

    // Non-Docker mode (original implementation)
    const ccProcess = new CCProcess({ ...options, mode: 'interactive' });
    const args = await ccProcess.buildCommand({ ...options, mode: 'interactive' });

    // Remove 'claude' from args as it's the command
    const claudeArgs = args.slice(1);

    // Helper to escape single quotes for shell
    const escapeShell = (str: string) => str.replace(/'/g, "'\\''");

    // Build shell command with exec to replace process
    let shellCommand: string;

    if (prompt && !options.resume && !options.continue) {
      // Use exec with echo piped to claude
      const escapedPrompt = escapeShell(prompt);
      const escapedArgs = claudeArgs.map((arg) => `'${escapeShell(arg)}'`).join(' ');
      shellCommand = `exec echo '${escapedPrompt}' | exec claude ${escapedArgs}`;
    } else {
      // No prompt - just exec claude directly
      const escapedArgs = claudeArgs.map((arg) => `'${escapeShell(arg)}'`).join(' ');
      shellCommand = `exec claude ${escapedArgs}`;
    }

    // Execute with shell, this replaces the current process
    execSync(shellCommand, {
      stdio: 'inherit',
    });

    // This line will never be reached because exec replaces the process
    // But TypeScript needs a return
    return { exitCode: 0 };
  } catch (error) {
    // This will only execute if spawnSync fails to launch
    console.error('Failed to launch Claude:', error);
    global.process.exit(1);
  }
}

/**
 * Template literal handler
 */
const templateHandler = (
  strings: TemplateStringsArray,
  ...values: InterpolationValue[]
): Promise<CCResult> => {
  // Combine template strings and values
  let prompt = '';
  strings.forEach((str, i) => {
    prompt += str;
    if (i < values.length) {
      prompt += String(values[i]);
    }
  });

  return claudeImpl(prompt);
};

/**
 * Main claude function with template literal support
 */
export const claude: ClaudeFunction = ((
  promptOrFileOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<CCResult> => {
  // Check if called as template literal
  if (Array.isArray(promptOrFileOrStrings) && 'raw' in promptOrFileOrStrings) {
    return templateHandler(
      promptOrFileOrStrings as TemplateStringsArray,
      ...(args as InterpolationValue[])
    );
  }

  // Otherwise it's a normal function call
  return claudeImpl(promptOrFileOrStrings as string, args[0] as ClaudeOptions);
}) as ClaudeFunction;

/**
 * Interactive mode shortcut
 */
export async function interactive(
  promptOrFile: string,
  options: ClaudeOptions = {}
): Promise<LaunchResult> {
  const template = new PromptTemplate();
  const ccOptions = convertOptions(options);

  let prompt: string;
  let mergedOptions = ccOptions;

  // Handle file vs inline prompt
  if (isFilePath(promptOrFile)) {
    const { config, content } = await loadPromptFile(promptOrFile);

    // Validate input if schema provided
    if (config.input && options.data) {
      const validationResult = validateInput(config.input, options.data);
      if (!validationResult.success) {
        return {
          error: `Input validation failed: ${validationResult.error}`,
        };
      }
    }

    prompt = template.interpolate(content, options.data || {});
    mergedOptions = { ...config, ...mergedOptions };
  } else {
    prompt = template.interpolate(promptOrFile, options.data || {});
  }

  return launchInteractive(prompt, mergedOptions);
}

/**
 * Stream mode shortcut
 */
export async function* stream(
  promptOrFile: string,
  options: ClaudeOptions = {}
): AsyncIterable<StreamChunk> {
  const template = new PromptTemplate();
  const ccOptions = convertOptions(options);
  const ccProcess = new CCProcess({ ...ccOptions, mode: 'stream' });

  let prompt: string;
  let mergedOptions = ccOptions;

  // Handle file vs inline prompt
  if (isFilePath(promptOrFile)) {
    const { config, content } = await loadPromptFile(promptOrFile);

    // Validate input if schema provided
    if (config.input && options.data) {
      const validationResult = validateInput(config.input, options.data);
      if (!validationResult.success) {
        yield {
          type: 'error',
          content: `Input validation failed: ${validationResult.error}`,
          timestamp: Date.now(),
        };
        return;
      }
    }

    prompt = template.interpolate(content, options.data || {});
    mergedOptions = { ...config, ...mergedOptions };
  } else {
    prompt = template.interpolate(promptOrFile, options.data || {});
  }

  yield* ccProcess.stream(prompt, { ...mergedOptions, mode: 'stream', parse: options.parse });
}

/**
 * Run mode shortcut (same as claude with mode: 'run')
 */
export async function run(promptOrFile: string, options: ClaudeOptions = {}): Promise<CCResult> {
  return claude(promptOrFile, { ...options, mode: 'run' });
}

/**
 * Detached mode shortcut - runs Claude in background
 *
 * @example
 * // Run in background
 * const result = await detached('prompt.md');
 * console.log('Started with PID:', result.data.pid);
 *
 * // Run with logging
 * await detached('long-task.md', {
 *   logFile: 'output.log',
 *   data: { taskId: '123' }
 * });
 *
 * // Run with real-time streaming to log file
 * await detached('long-task.md', {
 *   logFile: 'output.log',
 *   stream: true,
 *   data: { taskId: '123' }
 * });
 */
export async function detached(
  promptOrFile: string,
  options: ClaudeOptions = {}
): Promise<CCResult> {
  return claude(promptOrFile, { ...options, detached: true });
}
