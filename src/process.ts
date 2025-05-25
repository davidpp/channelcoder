import { spawn } from 'child_process';
import { resolveSystemPrompt } from './loader.js';
import type { CCOptions, CCResult, PromptConfig, StreamChunk } from './types.js';

/**
 * Process manager for Claude Code CLI execution
 */
export class CCProcess {
  private claudeAvailable?: boolean;
  private skipAvailabilityCheck = false;

  constructor(private defaultOptions: CCOptions) {
    // Allow skipping availability check for testing
    this.skipAvailabilityCheck =
      process.env.NODE_ENV === 'test' ||
      process.env.BUN_ENV === 'test' ||
      process.env.SKIP_CLAUDE_CHECK === 'true';
  }

  /**
   * Reset the Claude availability cache (mainly for testing)
   */
  resetClaudeAvailabilityCache() {
    this.claudeAvailable = undefined;
  }

  /**
   * Check if Claude CLI is available
   */
  private async checkClaudeAvailable(): Promise<boolean> {
    // Skip check in test environment
    if (this.skipAvailabilityCheck) {
      return true;
    }

    if (this.claudeAvailable !== undefined) {
      return this.claudeAvailable;
    }

    try {
      const proc = spawn('claude', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const exitCode = await new Promise<number>((resolve) => {
        proc.on('exit', (code) => resolve(code || 0));
        proc.on('error', () => resolve(1));
      });

      this.claudeAvailable = exitCode === 0;
      return this.claudeAvailable;
    } catch {
      this.claudeAvailable = false;
      return false;
    }
  }

  /**
   * Execute a prompt and wait for the result
   */
  async execute(prompt: string, options: CCOptions & PromptConfig): Promise<CCResult> {
    // Check if Claude CLI is available
    if (!(await this.checkClaudeAvailable())) {
      return {
        success: false,
        error:
          'Claude CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code',
      };
    }

    const cmd = await this.buildCommand(options);
    const [command, ...args] = cmd;

    try {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
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

      // Collect output
      let stdout = '';
      let stderr = '';

      if (proc.stdout) {
        proc.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
      }

      // Wait for process to exit
      const exitCode = await new Promise<number>((resolve, reject) => {
        proc.on('exit', (code) => resolve(code || 0));
        proc.on('error', reject);
      });

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
        if (stderr) {
          result.error += `\nStderr: ${stderr}`;
        }
        if (stdout) {
          // Try to parse error from stdout if it's JSON
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.is_error && parsed.result) {
              result.error = parsed.result;
            }
          } catch {
            // Not JSON, include raw stdout
            result.error += `\nStdout: ${stdout}`;
          }
        }
      }

      // Try to extract JSON if successful
      if (result.success && stdout) {
        // When using --output-format json, the entire output is JSON
        if (options.outputFormat === 'json') {
          try {
            const jsonData = JSON.parse(stdout);
            if (jsonData.type === 'result' && jsonData.result) {
              result.data = this.parseOutput(jsonData.result);
              if (!result.data) {
                // If parseOutput didn't find JSON, use the raw result
                result.data = jsonData.result;
              }
            }
          } catch {
            // Fallback to regular parsing
            const parsed = this.parseOutput(stdout);
            if (parsed) {
              result.data = parsed;
            } else {
              result.warnings = ['No JSON output found in response'];
            }
          }
        } else {
          const parsed = this.parseOutput(stdout);
          if (parsed) {
            result.data = parsed;
          } else {
            result.warnings = ['No JSON output found in response'];
          }
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
    // Check if Claude CLI is available
    if (!(await this.checkClaudeAvailable())) {
      yield {
        type: 'error',
        content:
          'Claude CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code',
        timestamp: Date.now(),
      };
      return;
    }

    const cmd = await this.buildCommand({
      ...options,
      outputFormat: 'stream-json',
    });
    const [command, ...args] = cmd;

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
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

    try {
      // Create a queue for chunks
      const chunks: StreamChunk[] = [];
      let done = false;
      let error: Error | null = null;

      // Process stdout
      if (proc.stdout) {
        let buffer = '';
        proc.stdout.setEncoding('utf8');

        proc.stdout.on('data', (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              chunks.push(this.parseStreamLine(line));
            }
          }
        });

        proc.stdout.on('end', () => {
          if (buffer.trim()) {
            chunks.push(this.parseStreamLine(buffer));
          }
        });
      }

      // Handle process events
      proc.on('error', (err) => {
        error = err;
        done = true;
      });

      proc.on('exit', (code) => {
        if (code !== 0 && !error) {
          chunks.push({
            type: 'error',
            content: `Process exited with code ${code}`,
            timestamp: Date.now(),
          });
        }
        done = true;
      });

      // Yield chunks as they become available
      while (!done || chunks.length > 0) {
        // Check for error first
        if (error) {
          yield {
            type: 'error',
            content: `Stream execution failed: ${(error as Error).message}`,
            timestamp: Date.now(),
          };
          break;
        }

        if (chunks.length > 0) {
          const chunk = chunks.shift();
          if (chunk) yield chunk;
        } else if (!done) {
          // Wait a bit for more chunks
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
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
    const cmd = ['claude'];

    // Conversation options (must come before -p)
    if (options.resume) {
      cmd.push('--resume', options.resume);
    } else if (options.continue) {
      cmd.push('--continue');
    } else {
      // Only add -p flag if not resuming/continuing
      cmd.push('-p');
    }

    // System prompt options
    if (options.systemPrompt) {
      const resolved = await resolveSystemPrompt(options.systemPrompt);
      cmd.push('--system-prompt', resolved);
    }
    if (options.appendSystemPrompt) {
      cmd.push('--append-system-prompt', options.appendSystemPrompt);
    }

    // Tool options
    if (options.allowedTools && options.allowedTools.length > 0) {
      cmd.push('--allowedTools', options.allowedTools.join(','));
    }
    if (options.disallowedTools && options.disallowedTools.length > 0) {
      cmd.push('--disallowedTools', options.disallowedTools.join(','));
    }

    // MCP options
    if (options.mcpConfig) {
      cmd.push('--mcp-config', options.mcpConfig);
    }
    if (options.permissionPromptTool) {
      cmd.push('--permission-prompt-tool', options.permissionPromptTool);
    }

    // Other options
    if (options.maxTurns !== undefined) {
      cmd.push('--max-turns', String(options.maxTurns));
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
