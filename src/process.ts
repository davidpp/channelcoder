import { resolveSystemPrompt } from './loader.js';
import type { CCOptions, CCResult, PromptConfig, StreamChunk } from './types.js';

/**
 * Process manager for Claude Code CLI execution
 */
export class CCProcess {
  constructor(private defaultOptions: CCOptions) {}

  /**
   * Execute a prompt and wait for the result
   */
  async execute(prompt: string, options: CCOptions & PromptConfig): Promise<CCResult> {
    const cmd = await this.buildCommand(options);

    try {
      const proc = Bun.spawn(cmd, {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // Write prompt to stdin
      if (proc.stdin) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }

      // Set up timeout if specified
      let timeoutId: Timer | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          proc.kill();
        }, options.timeout);
      }

      // Read stdout
      let stdout = '';
      if (proc.stdout) {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stdout += decoder.decode(value);
          }
        } catch (_error) {
          // Ignore read errors
        }
      }

      // Read stderr
      let stderr = '';
      if (proc.stderr) {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stderr += decoder.decode(value);
          }
        } catch (_error) {
          // Ignore read errors
        }
      }

      const exitCode = await proc.exited;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Log output if verbose
      if (options.verbose) {
        if (stdout) console.log('STDOUT:', stdout);
        if (stderr) console.error('STDERR:', stderr);
      }

      // Parse result
      const result: CCResult = {
        success: exitCode === 0,
        stdout,
        stderr,
      };

      if (exitCode !== 0) {
        result.error = `Process exited with code ${exitCode}`;
      }

      // Try to extract JSON if successful
      if (result.success && stdout) {
        const parsed = this.parseOutput(stdout);
        if (parsed) {
          result.data = parsed;
        } else {
          result.warnings = ['No JSON output found in response'];
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Process execution failed: ${error}`,
      };
    }
  }

  /**
   * Stream prompt execution
   */
  async *stream(prompt: string, options: CCOptions & PromptConfig): AsyncIterable<StreamChunk> {
    const cmd = await this.buildCommand({
      ...options,
      outputFormat: 'stream-json',
    });

    try {
      const proc = Bun.spawn(cmd, {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // Write prompt to stdin
      if (proc.stdin) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }

      // Set up timeout
      let timeoutId: Timer | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          proc.kill();
        }, options.timeout);
      }

      // Stream stdout
      if (proc.stdout) {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                yield this.parseStreamLine(line);
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim()) {
            yield this.parseStreamLine(buffer);
          }
        } catch (error) {
          yield {
            type: 'error',
            content: `Stream error: ${error}`,
            timestamp: Date.now(),
          };
        }
      }

      // Handle process exit
      const exitCode = await proc.exited;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (exitCode !== 0) {
        yield {
          type: 'error',
          content: `Process exited with code ${exitCode}`,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      yield {
        type: 'error',
        content: `Stream execution failed: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build command arguments for Claude Code CLI
   */
  private async buildCommand(options: CCOptions & PromptConfig): Promise<string[]> {
    const cmd = ['claude', '-p'];

    // Add system prompt if specified
    if (options.systemPrompt) {
      const resolved = await resolveSystemPrompt(options.systemPrompt);
      cmd.push('--system-prompt', resolved);
    }

    // Add allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      cmd.push('--allowedTools', options.allowedTools.join(' '));
    }

    // Add output format
    if (options.outputFormat) {
      cmd.push('--output-format', options.outputFormat);
      // stream-json requires verbose flag
      if (options.outputFormat === 'stream-json') {
        cmd.push('--verbose');
      }
    }

    // Add verbose flag
    if (options.verbose && options.outputFormat !== 'stream-json') {
      cmd.push('--verbose');
    }

    return cmd;
  }

  /**
   * Parse JSON from output
   */
  private parseOutput(output: string): unknown | null {
    // Try to extract JSON from code blocks
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (_e) {
        return null;
      }
    }

    // Try to parse entire output as JSON
    try {
      return JSON.parse(output);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Parse a stream line into a chunk
   */
  private parseStreamLine(line: string): StreamChunk {
    try {
      const data = JSON.parse(line);

      // Handle different event types from Claude's stream-json format
      if (data.type === 'assistant' && data.message?.content) {
        // Extract text from assistant messages
        const content = data.message.content;
        if (Array.isArray(content)) {
          const textContent = content.find(
            (c: unknown) => (c as { type?: string }).type === 'text'
          );
          if ((textContent as { text?: string })?.text) {
            return {
              type: 'content',
              content: (textContent as { text: string }).text,
              timestamp: Date.now(),
            };
          }
        }
      } else if (data.type === 'content') {
        return {
          type: 'content',
          content: data.text || '',
          timestamp: Date.now(),
        };
      } else if (data.type === 'tool_use') {
        return {
          type: 'tool_use',
          content: JSON.stringify(data),
          timestamp: Date.now(),
        };
      } else if (data.type === 'tool_result') {
        return {
          type: 'tool_result',
          content: JSON.stringify(data),
          timestamp: Date.now(),
        };
      } else if (data.error) {
        return {
          type: 'error',
          content: data.error,
          timestamp: Date.now(),
        };
      }

      // Ignore system and result messages in streaming
      if (data.type === 'system' || data.type === 'result') {
        return {
          type: 'content',
          content: '',
          timestamp: Date.now(),
        };
      }

      // Default: treat as content
      return {
        type: 'content',
        content: line,
        timestamp: Date.now(),
      };
    } catch (_e) {
      // If not JSON, treat as plain content
      return {
        type: 'content',
        content: line,
        timestamp: Date.now(),
      };
    }
  }
}
