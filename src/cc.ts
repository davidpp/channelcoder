import { spawn, spawnSync } from 'node:child_process';
import { openSync, writeSync } from 'node:fs';
import { z } from 'zod';
import { loadPromptFile } from './loader.js';
import { CCProcess } from './process.js';
import { PromptBuilder } from './prompt-builder.js';
import { PromptTemplate } from './template.js';
import type {
  CCOptions,
  CCResult,
  InterpolationData,
  InterpolationValue,
  LaunchOptions,
  LaunchResult,
  PromptConfig,
  RunOptions,
  StreamChunk,
  StreamOptions,
} from './types.js';

/**
 * Main CC (Claude Code) SDK class
 */
export class CC {
  private options: CCOptions;
  private process: CCProcess;
  private template: PromptTemplate;

  constructor(options: CCOptions = {}) {
    this.options = {
      timeout: 120000, // 2 minutes default
      verbose: false,
      outputFormat: 'json',
      ...options,
    };
    this.process = new CCProcess(this.options);
    this.template = new PromptTemplate();
  }

  /**
   * Create a prompt using template literals
   * @example
   * ```typescript
   * const result = await cc.prompt`
   *   Analyze task ${taskId}
   * `.run();
   * ```
   */
  prompt(strings: TemplateStringsArray, ...values: InterpolationValue[]): PromptBuilder {
    // Combine template strings and values
    let prompt = '';
    strings.forEach((str, i) => {
      prompt += str;
      if (i < values.length) {
        prompt += `\${${i}}`;
      }
    });

    return new PromptBuilder(prompt, values, this);
  }

  /**
   * Load and execute a prompt from a file
   * @param path Path to prompt file with frontmatter
   * @param input Input data for variable interpolation and validation
   */
  async fromFile(path: string, input?: InterpolationData): Promise<CCResult> {
    const { config, content } = await loadPromptFile(path);

    // Validate input if schema provided
    if (config.input && input) {
      const validationResult = this.validateInput(config.input, input);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Input validation failed: ${validationResult.error}`,
        };
      }
    }

    // Interpolate variables
    const interpolated = this.template.interpolate(content, input || {});

    // Execute with config
    return this.run(interpolated, config);
  }

  /**
   * Execute a prompt directly
   */
  async run(prompt: string | PromptBuilder, options?: RunOptions): Promise<CCResult> {
    // Handle PromptBuilder
    if (prompt instanceof PromptBuilder) {
      return prompt.run();
    }

    // Merge options with defaults
    const runOptions = { ...this.options, ...options };

    try {
      // Execute through process manager
      const result = await this.process.execute(prompt, runOptions);

      // Parse output if schema provided
      if (options?.output && result.success && result.data) {
        const validation = this.validate(result, options.output);
        if (!validation.success) {
          result.warnings = result.warnings || [];
          result.warnings.push(`Output validation failed: ${validation.error}`);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stream a prompt execution
   */
  async *stream(
    prompt: string | PromptBuilder,
    options?: StreamOptions
  ): AsyncIterable<StreamChunk> {
    // Handle PromptBuilder
    if (prompt instanceof PromptBuilder) {
      yield* prompt.stream();
      return;
    }

    // Merge options
    const streamOptions = { ...this.options, ...options };

    try {
      yield* this.process.stream(prompt, streamOptions);
    } catch (error) {
      yield {
        type: 'error' as const,
        content: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Launch Claude without capturing output
   */
  async launch(
    prompt: string | PromptBuilder,
    options?: LaunchOptions & RunOptions
  ): Promise<LaunchResult> {
    try {
      // Handle PromptBuilder
      let finalPrompt: string;
      let finalOptions = options;

      if (prompt instanceof PromptBuilder) {
        const builder = prompt as any; // Access private properties
        finalPrompt = builder.prompt;
        finalOptions = { ...options, ...builder.options };
      } else {
        finalPrompt = prompt;
      }

      // Merge options with defaults
      const runOptions = { ...this.options, ...finalOptions };

      // Build command args
      const args = await (this.process as any).buildCommand(runOptions);

      // Add prompt if not resuming/continuing
      if (!runOptions.resume && !runOptions.continue) {
        const promptIndex = args.indexOf('-p');
        if (promptIndex >= 0 && promptIndex < args.length - 1) {
          args[promptIndex + 1] = finalPrompt;
        }
      }

      // Remove 'claude' from args as it's the command
      const claudeArgs = args.slice(1);

      switch (options?.mode) {
        case 'detached': {
          // Launch detached process
          const stdio = options.logFile
            ? ['ignore', openSync(options.logFile, 'a'), openSync(options.logFile, 'a')]
            : 'ignore';

          const child = spawn('claude', claudeArgs, {
            detached: true,
            stdio: stdio as any, // stdio type is complex union type
            env: { ...process.env, ...options.env },
            cwd: options.cwd,
          });

          child.unref();
          return { pid: child.pid };
        }

        case 'background': {
          // Launch in background but keep connected
          const child = spawn('claude', claudeArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, ...options.env },
            cwd: options.cwd,
          });

          // Optionally log output
          if (options.logFile) {
            const logFd = openSync(options.logFile, 'a');
            child.stdout?.on('data', (data) => {
              writeSync(logFd, data);
            });
            child.stderr?.on('data', (data) => {
              writeSync(logFd, data);
            });
          }

          return { pid: child.pid };
        }

        default: {
          // Interactive mode (default)
          const result = spawnSync('claude', claudeArgs, {
            stdio: 'inherit',
            env: { ...process.env, ...options?.env },
            cwd: options?.cwd,
            shell: options?.shell,
          });

          if (result.error) {
            return { error: result.error.message };
          }

          return { exitCode: result.status ?? undefined };
        }
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate input against schema
   */
  private validateInput(
    schema: z.ZodSchema | Record<string, z.ZodType>,
    input: InterpolationData
  ): { success: true } | { success: false; error: string } {
    try {
      // Convert record to object schema if needed
      const zodSchema =
        schema instanceof z.ZodSchema ? schema : z.object(schema as Record<string, z.ZodType>);

      zodSchema.parse(input);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: errors };
      }
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate result against schema
   */
  validate<T = unknown>(
    result: CCResult,
    schema: z.ZodSchema<T> | Record<string, z.ZodType>,
    context?: string
  ): { success: true; data: T } | { success: false; error: string } {
    if (!result.success) {
      return {
        success: false,
        error: `${context || 'Operation'} failed: ${result.error || 'Unknown error'}`,
      };
    }

    if (!result.data) {
      return {
        success: false,
        error: `${context || 'Operation'} did not return any data`,
      };
    }

    try {
      // Convert Record<string, z.ZodType> to z.ZodSchema if needed
      const zodSchema =
        schema instanceof z.ZodSchema ? schema : z.object(schema as Record<string, z.ZodType>);

      const validatedData = zodSchema.parse(result.data);
      return { success: true, data: validatedData as T };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');

        return {
          success: false,
          error: `${context || 'Validation'} failed: ${errorMessages}`,
        };
      }

      return {
        success: false,
        error: `${context || 'Validation'} error: ${error}`,
      };
    }
  }
}
