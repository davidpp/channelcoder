import { z } from 'zod';
import type { CCOptions, CCResult, PromptConfig, RunOptions, StreamOptions, StreamChunk } from './types.js';
import { PromptBuilder } from './prompt-builder.js';
import { PromptTemplate } from './template.js';
import { CCProcess } from './process.js';
import { loadPromptFile } from './loader.js';

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
      ...options
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
  prompt(strings: TemplateStringsArray, ...values: any[]): PromptBuilder {
    // Combine template strings and values
    let prompt = '';
    strings.forEach((str, i) => {
      prompt += str;
      if (i < values.length) {
        prompt += '${' + i + '}';
      }
    });

    return new PromptBuilder(prompt, values, this);
  }

  /**
   * Load and execute a prompt from a file
   * @param path Path to prompt file with frontmatter
   * @param input Input data for variable interpolation and validation
   */
  async fromFile(path: string, input?: any): Promise<CCResult> {
    const { config, content } = await loadPromptFile(path);
    
    // Validate input if schema provided
    if (config.input && input) {
      const validationResult = this.validateInput(config.input, input);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Input validation failed: ${validationResult.error}`
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
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Stream a prompt execution
   */
  async *stream(prompt: string | PromptBuilder, options?: StreamOptions): AsyncIterable<StreamChunk> {
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
        timestamp: Date.now()
      };
    }
  }

  /**
   * Validate input against schema
   */
  private validateInput(schema: z.ZodSchema | Record<string, z.ZodType>, input: any): { success: true } | { success: false; error: string } {
    try {
      // Convert record to object schema if needed
      const zodSchema = schema instanceof z.ZodSchema 
        ? schema 
        : z.object(schema as Record<string, z.ZodType>);
      
      zodSchema.parse(input);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: errors };
      }
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate result against schema
   */
  validate<T>(
    result: CCResult, 
    schema: z.ZodSchema<T>,
    context?: string
  ): { success: true; data: T } | { success: false; error: string } {
    if (!result.success) {
      return { 
        success: false, 
        error: `${context || 'Operation'} failed: ${result.error || 'Unknown error'}` 
      };
    }
    
    if (!result.data) {
      return { 
        success: false, 
        error: `${context || 'Operation'} did not return any data` 
      };
    }
    
    try {
      const validatedData = schema.parse(result.data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        return { 
          success: false, 
          error: `${context || 'Validation'} failed: ${errorMessages}` 
        };
      }
      
      return { 
        success: false, 
        error: `${context || 'Validation'} error: ${error}` 
      };
    }
  }
}