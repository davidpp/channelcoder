import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, writeSync } from 'node:fs';
import { loadPromptFile } from './loader.js';
import { CCProcess } from './process.js';
import { PromptTemplate } from './template.js';
import type {
  CCOptions,
  CCResult,
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
  outputFormat?: 'json' | 'text'; // Output format
  timeout?: number; // Timeout in milliseconds
  dryRun?: boolean; // Return command instead of executing
  parse?: boolean; // Parse JSON messages in stream mode (default: false)

  // Process control
  detached?: boolean; // Run in detached mode (background)
  logFile?: string; // Log file path for detached mode output
  stream?: boolean; // Enable streaming output in detached mode
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
    outputFormat: options.outputFormat || 'json',
    resume: options.resume,
    continue: options.continue,
    maxTurns: options.maxTurns,
    timeout: options.timeout, // No default timeout
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
  const process = new CCProcess(ccOptions);
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
    const args = await process.buildCommand(mergedOptions);

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
    // Enable streaming output format if stream option is set
    if (options.stream) {
      mergedOptions.outputFormat = 'stream-json';
      if (!options.logFile) {
        return {
          success: false,
          error: 'logFile is required when using detached streaming mode',
        };
      }
    }

    const args = await process.buildCommand(mergedOptions);

    // Set up stdio based on logFile
    let stdio: 'ignore' | ['pipe', number, number] = 'ignore';
    let logFd: number | undefined;

    if (options.logFile) {
      // Open log file for writing (append mode)
      logFd = openSync(options.logFile, 'a');
      stdio = ['pipe', logFd, logFd];
    }

    const child = spawn(args[0], args.slice(1), {
      detached: true,
      stdio,
    });

    // Write prompt to stdin if needed
    if (child.stdin && !mergedOptions.resume && !mergedOptions.continue) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    // Unref to allow parent to exit
    child.unref();

    // Close log file descriptor if opened
    if (logFd !== undefined) {
      closeSync(logFd);
    }

    return {
      success: true,
      data: {
        pid: child.pid,
        detached: true,
        logFile: options.logFile,
        streaming: options.stream || false,
      },
    };
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
      for await (const chunk of process.stream(prompt, mergedOptions)) {
        chunks.push(chunk.content);
      }
      return {
        success: true,
        data: chunks.join(''),
      };
    }

    default:
      return process.execute(prompt, mergedOptions);
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
    const process = new CCProcess({ ...options, mode: 'interactive' });
    const args = await process.buildCommand({ ...options, mode: 'interactive' });

    // Remove 'claude' from args as it's the command
    const claudeArgs = args.slice(1);

    if (prompt && !options.resume && !options.continue) {
      // Use spawnSync with input option to provide prompt while maintaining TTY
      const result = spawnSync('claude', claudeArgs, {
        stdio: ['pipe', 'inherit', 'inherit'],
        input: prompt,
        encoding: 'utf8',
      });

      if (result.error) {
        throw result.error;
      }

      return { exitCode: result.status || 0 };
    } else {
      // No prompt - just run claude directly with full TTY
      const result = spawnSync('claude', claudeArgs, {
        stdio: 'inherit',
      });

      if (result.error) {
        throw result.error;
      }

      return { exitCode: result.status || 0 };
    }
  } catch (error) {
    // This will only execute if spawnSync fails to launch
    console.error('Failed to launch Claude:', error);
    process.exit(1);
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
  const process = new CCProcess({ ...ccOptions, mode: 'stream' });

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

  yield* process.stream(prompt, { ...mergedOptions, mode: 'stream', parse: options.parse });
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
