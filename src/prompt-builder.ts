import type { z } from 'zod';
import type { CC } from './cc.js';
import type {
  CCResult,
  InterpolationValue,
  LaunchOptions,
  LaunchResult,
  PromptConfig,
  StreamChunk,
} from './types.js';

/**
 * Fluent builder for prompts created with cc.prompt``
 */
export class PromptBuilder {
  private config: PromptConfig = {};

  constructor(
    private template: string,
    private values: InterpolationValue[],
    private cc: CC
  ) {}

  /**
   * Set system prompt (inline or file path)
   */
  withSystemPrompt(systemPrompt: string): PromptBuilder {
    this.config.systemPrompt = systemPrompt;
    return this;
  }

  /**
   * Set allowed tools
   */
  withTools(tools: string[]): PromptBuilder {
    this.config.allowedTools = tools;
    return this;
  }

  /**
   * Set input schema for validation
   */
  withInputSchema(schema: z.ZodSchema | Record<string, z.ZodType>): PromptBuilder {
    this.config.input = schema;
    return this;
  }

  /**
   * Set output schema for parsing
   */
  withOutputSchema(schema: z.ZodSchema): PromptBuilder {
    this.config.output = schema;
    return this;
  }

  /**
   * Shorthand for setting output schema
   */
  withSchema(schema: z.ZodSchema): PromptBuilder {
    return this.withOutputSchema(schema);
  }

  /**
   * Build the final prompt by interpolating values
   */
  private buildPrompt(): string {
    let result = this.template;
    this.values.forEach((value, index) => {
      const placeholder = `\${${index}}`;
      const replacement = this.formatValue(value);
      result = result.replace(placeholder, replacement);
    });
    return result;
  }

  /**
   * Format a value for interpolation
   */
  private formatValue(value: InterpolationValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Execute the prompt
   */
  async run(): Promise<CCResult> {
    const prompt = this.buildPrompt();
    return this.cc.run(prompt, this.config);
  }

  /**
   * Stream the prompt execution
   */
  async *stream(): AsyncIterable<StreamChunk> {
    const prompt = this.buildPrompt();
    yield* this.cc.stream(prompt, this.config);
  }

  /**
   * Launch the prompt interactively
   */
  async launch(options?: LaunchOptions): Promise<LaunchResult> {
    const prompt = this.buildPrompt();
    return this.cc.launch(prompt, { ...options, ...this.config });
  }

  /**
   * Get the built prompt (for debugging)
   */
  toString(): string {
    return this.buildPrompt();
  }
}
