import { spawn } from 'child_process';
import { DockerManager } from './docker.js';
import { resolveSystemPrompt } from './loader.js';
import { eventToChunk, extractSessionId, parseStreamEvent } from './stream-parser/index.js';
import type {
  CCOptions,
  CCResult,
  PromptConfig,
  ResolvedDockerConfig,
  StreamChunk,
} from './types.js';
import { WorktreeManager } from './worktree/manager.js';
import type { WorktreeInfo, WorktreeOptions } from './worktree/types.js';

/**
 * Process manager for Claude Code CLI execution
 */
export class CCProcess {
  private claudeAvailable?: boolean;
  private skipAvailabilityCheck = false;
  private dockerManager: DockerManager;
  private worktreeManager: WorktreeManager;

  constructor(private defaultOptions: CCOptions) {
    // Allow skipping availability check for testing
    this.skipAvailabilityCheck =
      process.env.NODE_ENV === 'test' ||
      process.env.BUN_ENV === 'test' ||
      process.env.SKIP_CLAUDE_CHECK === 'true';

    this.dockerManager = new DockerManager();
    this.worktreeManager = new WorktreeManager();
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
    // Handle Worktree mode
    if (options.worktree) {
      return this.executeInWorktree(prompt, options);
    }

    // Handle Docker mode
    if (options.docker) {
      return this.executeInDocker(prompt, options);
    }

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

            // Extract session ID if present
            if (jsonData.session_id) {
              result.sessionId = jsonData.session_id;
            }

            // Also check for session ID in type: "system" messages
            if (jsonData.type === 'system' && jsonData.session_id) {
              result.sessionId = jsonData.session_id;
            }

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

          // For stream-json format, check stdout for session_id
          try {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const event = parseStreamEvent(line);
                if (event) {
                  const sessionId = extractSessionId(event);
                  if (sessionId) {
                    result.sessionId = sessionId;
                    break;
                  }
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Also check stderr for session ID
      if (result.success && stderr) {
        // Check for session ID in various formats
        const sessionMatch = stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);
        if (sessionMatch) {
          result.sessionId = sessionMatch[1];
        }

        // Also check for session_id in JSON output (stream-json format)
        try {
          // stderr might contain multiple JSON lines in stream-json format
          const lines = stderr.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('session_id')) {
              const data = JSON.parse(line);
              if (data.session_id) {
                result.sessionId = data.session_id;
                break;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
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
  async *stream(
    prompt: string,
    options: CCOptions & PromptConfig & { parse?: boolean }
  ): AsyncIterable<StreamChunk> {
    // Handle Worktree mode
    if (options.worktree) {
      yield* this.streamInWorktree(prompt, options);
      return;
    }

    // Handle Docker mode
    if (options.docker) {
      yield* this.streamInDocker(prompt, options);
      return;
    }

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

    // Default parse to false for raw output
    const shouldParse = options.parse ?? false;

    // Always use stream-json for actual streaming
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

    // Create a queue for chunks
    const chunks: StreamChunk[] = [];
    let done = false;
    let error: Error | null = null;

    // Set up timeout
    let timeoutId: Timer | undefined;
    let timedOut = false;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!done) proc.kill('SIGKILL');
        }, 5000);
      }, options.timeout);
    }

    try {
      // Process stdout
      if (proc.stdout) {
        let buffer = '';
        proc.stdout.setEncoding('utf8');

        proc.stdout.on('data', (chunk: string) => {
          if (!shouldParse) {
            // Raw mode - yield raw JSON chunks directly
            chunks.push({
              type: 'content',
              content: chunk,
              timestamp: Date.now(),
            });
          } else {
            // Parse mode - parse JSON and extract content
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                const event = parseStreamEvent(line);
                if (event) {
                  const chunk = eventToChunk(event);
                  // Skip empty content chunks in parse mode
                  if (chunk && (chunk.content || chunk.type === 'error')) {
                    chunks.push(chunk);
                  }
                }
              }
            }
          }
        });

        proc.stdout.on('end', () => {
          if (shouldParse && buffer.trim()) {
            // Parse mode - handle remaining buffer
            const event = parseStreamEvent(buffer);
            if (event) {
              const chunk = eventToChunk(event);
              if (chunk && (chunk.content || chunk.type === 'error')) {
                chunks.push(chunk);
              }
            }
          }
          // Raw mode doesn't need end handling since we stream everything
        });
      }

      // Capture stderr for better error messages
      let stderrBuffer = '';
      if (proc.stderr) {
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (chunk: string) => {
          stderrBuffer += chunk;
        });
      }

      // Handle process events
      proc.on('error', (err) => {
        error = err;
        done = true;
      });

      proc.on('exit', (code, signal) => {
        if (code !== 0 && !error) {
          let errorMessage: string;
          if (timedOut) {
            errorMessage = `Request timed out after ${options.timeout}ms`;
          } else {
            errorMessage = `Process exited with code ${code}`;
            if (signal) {
              errorMessage += ` (signal: ${signal})`;
            }
          }
          if (stderrBuffer.trim()) {
            errorMessage += `\n${stderrBuffer.trim()}`;
          }
          chunks.push({
            type: 'error',
            content: errorMessage,
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
  async buildCommand(options: CCOptions & PromptConfig): Promise<string[]> {
    const cmd = ['claude'];

    // Conversation options
    if (options.resume) {
      cmd.push('--resume', options.resume);
    } else if (options.continue) {
      cmd.push('--continue');
    }

    // Only add --print flag for non-interactive modes
    if (options.mode !== 'interactive') {
      cmd.push('--print');
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

    // Handle dangerouslySkipPermissions with Docker-aware defaults
    if (options.docker) {
      // When using Docker, skip permissions by default (safe due to firewall)
      // User must explicitly set to false to enable permission prompts
      if (options.dangerouslySkipPermissions !== false) {
        cmd.push('--dangerously-skip-permissions');
      }
    } else {
      // Without Docker, only skip if explicitly requested
      if (options.dangerouslySkipPermissions) {
        cmd.push('--dangerously-skip-permissions');
      }
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
   * Execute in Docker container
   */
  private async executeInDocker(
    prompt: string,
    options: CCOptions & PromptConfig
  ): Promise<CCResult> {
    // Check if Docker is available
    if (!(await this.dockerManager.checkDockerAvailable())) {
      return {
        success: false,
        error: 'Docker not found. Please install Docker to use Docker mode.',
      };
    }

    try {
      // Resolve Docker configuration
      if (!options.docker) {
        throw new Error('Docker option is required but not provided');
      }
      const dockerConfig = await this.dockerManager.resolveDockerConfig(options.docker);

      // Build image if needed
      if (dockerConfig.needsBuild && dockerConfig.dockerfilePath) {
        const imageExists = await this.dockerManager.imageExists(dockerConfig.image);
        if (!imageExists) {
          await this.dockerManager.buildImage(dockerConfig.dockerfilePath, dockerConfig.image);
        }
      }

      // Build Docker args
      const dockerArgs = this.dockerManager.buildDockerArgs(dockerConfig, false);

      // Build Claude command args
      const claudeCmd = await this.buildCommand(options);
      const claudeArgs = claudeCmd.slice(1); // Remove 'claude' from args

      // Combine Docker and Claude args
      const fullArgs = [...dockerArgs, 'claude', ...claudeArgs];

      // Execute with Docker
      const proc = spawn('docker', fullArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Write prompt to stdin
      if (proc.stdin && !options.resume && !options.continue) {
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

      // Parse result (same as regular execution)
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

            // Extract session ID if present
            if (jsonData.session_id) {
              result.sessionId = jsonData.session_id;
            }

            // Also check for session ID in type: "system" messages
            if (jsonData.type === 'system' && jsonData.session_id) {
              result.sessionId = jsonData.session_id;
            }

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

          // For stream-json format, check stdout for session_id
          try {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const event = parseStreamEvent(line);
                if (event) {
                  const sessionId = extractSessionId(event);
                  if (sessionId) {
                    result.sessionId = sessionId;
                    break;
                  }
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Also check stderr for session ID
      if (result.success && stderr) {
        // Check for session ID in various formats
        const sessionMatch = stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);
        if (sessionMatch) {
          result.sessionId = sessionMatch[1];
        }

        // Also check for session_id in JSON output (stream-json format)
        try {
          // stderr might contain multiple JSON lines in stream-json format
          const lines = stderr.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('session_id')) {
              const data = JSON.parse(line);
              if (data.session_id) {
                result.sessionId = data.session_id;
                break;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Docker execution failed: ${error}`,
      };
    }
  }

  /**
   * Stream execution in Docker container
   */
  private async *streamInDocker(
    prompt: string,
    options: CCOptions & PromptConfig & { parse?: boolean }
  ): AsyncIterable<StreamChunk> {
    // Check if Docker is available
    if (!(await this.dockerManager.checkDockerAvailable())) {
      yield {
        type: 'error',
        content: 'Docker not found. Please install Docker to use Docker mode.',
        timestamp: Date.now(),
      };
      return;
    }

    try {
      // Resolve Docker configuration
      if (!options.docker) {
        throw new Error('Docker option is required but not provided');
      }
      const dockerConfig = await this.dockerManager.resolveDockerConfig(options.docker);

      // Build image if needed
      if (dockerConfig.needsBuild && dockerConfig.dockerfilePath) {
        const imageExists = await this.dockerManager.imageExists(dockerConfig.image);
        if (!imageExists) {
          await this.dockerManager.buildImage(dockerConfig.dockerfilePath, dockerConfig.image);
        }
      }

      // Default parse to false for raw output
      const shouldParse = options.parse ?? false;

      // Always use stream-json for actual streaming
      const streamOptions = {
        ...options,
        outputFormat: 'stream-json' as const,
      };

      // Build Docker args
      const dockerArgs = this.dockerManager.buildDockerArgs(dockerConfig, false);

      // Build Claude command args
      const claudeCmd = await this.buildCommand(streamOptions);
      const claudeArgs = claudeCmd.slice(1); // Remove 'claude' from args

      // Combine Docker and Claude args
      const fullArgs = [...dockerArgs, 'claude', ...claudeArgs];

      const proc = spawn('docker', fullArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Write prompt to stdin
      if (proc.stdin && !options.resume && !options.continue) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }

      // Create a queue for chunks
      const chunks: StreamChunk[] = [];
      let done = false;
      let error: Error | null = null;

      // Set up timeout
      let timeoutId: Timer | undefined;
      let timedOut = false;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (!done) proc.kill('SIGKILL');
          }, 5000);
        }, options.timeout);
      }

      // Process stdout
      if (proc.stdout) {
        let buffer = '';
        proc.stdout.setEncoding('utf8');

        proc.stdout.on('data', (chunk: string) => {
          if (!shouldParse) {
            // Raw mode - yield raw JSON chunks directly
            chunks.push({
              type: 'content',
              content: chunk,
              timestamp: Date.now(),
            });
          } else {
            // Parse mode - parse JSON and extract content
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                const event = parseStreamEvent(line);
                if (event) {
                  const chunk = eventToChunk(event);
                  // Skip empty content chunks in parse mode
                  if (chunk && (chunk.content || chunk.type === 'error')) {
                    chunks.push(chunk);
                  }
                }
              }
            }
          }
        });

        proc.stdout.on('end', () => {
          if (shouldParse && buffer.trim()) {
            // Parse mode - handle remaining buffer
            const event = parseStreamEvent(buffer);
            if (event) {
              const chunk = eventToChunk(event);
              if (chunk && (chunk.content || chunk.type === 'error')) {
                chunks.push(chunk);
              }
            }
          }
          // Raw mode doesn't need end handling since we stream everything
        });
      }

      // Capture stderr for better error messages
      let stderrBuffer = '';
      if (proc.stderr) {
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (chunk: string) => {
          stderrBuffer += chunk;
        });
      }

      // Handle process events
      proc.on('error', (err) => {
        error = err;
        done = true;
      });

      proc.on('exit', (code, signal) => {
        if (code !== 0 && !error) {
          let errorMessage: string;
          if (timedOut) {
            errorMessage = `Request timed out after ${options.timeout}ms`;
          } else {
            errorMessage = `Process exited with code ${code}`;
            if (signal) {
              errorMessage += ` (signal: ${signal})`;
            }
          }
          if (stderrBuffer.trim()) {
            errorMessage += `\n${stderrBuffer.trim()}`;
          }
          chunks.push({
            type: 'error',
            content: errorMessage,
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
        content: `Docker stream execution failed: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Execute in worktree context
   */
  private async executeInWorktree(
    prompt: string,
    options: CCOptions & PromptConfig
  ): Promise<CCResult> {
    try {
      // Resolve worktree configuration
      if (!options.worktree) {
        throw new Error('Worktree option is required but not provided');
      }
      const worktreeConfig = this.resolveWorktreeConfig(options.worktree);

      // Ensure worktree exists
      const worktreeInfo = await this.worktreeManager.ensureWorktree(
        worktreeConfig.branch,
        worktreeConfig
      );

      // Execute within worktree context
      return await this.worktreeManager.executeInWorktree(worktreeInfo, async () => {
        // Create new options without worktree to avoid infinite recursion
        const { worktree: _, ...executeOptions } = options;

        // Check if we also need Docker within the worktree
        if (options.docker) {
          return this.executeInDocker(prompt, executeOptions);
        }

        // Regular execution within worktree
        return this.execute(prompt, executeOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `Worktree execution failed: ${error}`,
      };
    }
  }

  /**
   * Stream execution in worktree context
   */
  private async *streamInWorktree(
    prompt: string,
    options: CCOptions & PromptConfig & { parse?: boolean }
  ): AsyncIterable<StreamChunk> {
    try {
      // Resolve worktree configuration
      if (!options.worktree) {
        throw new Error('Worktree option is required but not provided');
      }
      const worktreeConfig = this.resolveWorktreeConfig(options.worktree);

      // Ensure worktree exists
      const worktreeInfo = await this.worktreeManager.ensureWorktree(
        worktreeConfig.branch,
        worktreeConfig
      );

      // Create async generator function that will run in worktree context
      const streamGenerator = async function* (self: CCProcess) {
        // Create new options without worktree to avoid infinite recursion
        const { worktree: _, ...streamOptions } = options;

        // Check if we also need Docker within the worktree
        if (options.docker) {
          yield* self.streamInDocker(prompt, streamOptions);
        } else {
          // Regular streaming within worktree
          yield* self.stream(prompt, streamOptions);
        }
      };

      // Execute the generator within worktree context
      yield* await this.worktreeManager.executeInWorktree(worktreeInfo, async () => {
        return streamGenerator(this);
      });
    } catch (error) {
      yield {
        type: 'error',
        content: `Worktree stream execution failed: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Resolve worktree configuration from options
   */
  private resolveWorktreeConfig(
    worktree: boolean | string | WorktreeOptions
  ): WorktreeOptions & { branch: string } {
    if (typeof worktree === 'boolean') {
      throw new Error(
        'Worktree requires a branch name. Use worktree: "branch-name" or worktree: { branch: "branch-name" }'
      );
    }

    if (typeof worktree === 'string') {
      return { branch: worktree };
    }

    if (!worktree.branch) {
      throw new Error('Worktree configuration must specify a branch name');
    }

    return worktree as WorktreeOptions & { branch: string };
  }

  /**
   * Execute in detached mode with proper context handling
   */
  async executeDetached(prompt: string, options: CCOptions & PromptConfig): Promise<CCResult> {
    // Handle Worktree mode
    if (options.worktree) {
      return this.executeDetachedInWorktree(prompt, options);
    }

    // Handle Docker mode
    if (options.docker) {
      return this.executeDetachedInDocker(prompt, options);
    }

    // Regular detached execution
    return this.executeDetachedBase(prompt, options);
  }

  /**
   * Base detached execution implementation
   */
  private async executeDetachedBase(
    prompt: string,
    options: CCOptions & PromptConfig
  ): Promise<CCResult> {
    // Check if Claude CLI is available
    if (!(await this.checkClaudeAvailable())) {
      return {
        success: false,
        error:
          'Claude CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code',
      };
    }

    // Enable streaming output format if stream option is set
    const detachedOptions = { ...options };
    if (options.stream) {
      detachedOptions.outputFormat = 'stream-json';
      if (!options.logFile) {
        return {
          success: false,
          error: 'logFile is required when using detached streaming mode',
        };
      }
    }

    const args = await this.buildCommand(detachedOptions);

    // Set up stdio based on logFile
    let stdio: 'ignore' | ['pipe', number, number] = 'ignore';
    let logFd: number | undefined;

    if (options.logFile) {
      // Open log file for writing (append mode)
      const { openSync } = await import('node:fs');
      logFd = openSync(options.logFile, 'a');
      stdio = ['pipe', logFd, logFd];
    }

    const { spawn } = await import('node:child_process');
    const child = spawn(args[0], args.slice(1), {
      detached: true,
      stdio,
    });

    // Write prompt to stdin if needed
    if (child.stdin && !options.resume && !options.continue) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    // Unref to allow parent to exit
    child.unref();

    // Close log file descriptor if opened
    if (logFd !== undefined) {
      const { closeSync } = await import('node:fs');
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

  /**
   * Execute detached in worktree context
   */
  private async executeDetachedInWorktree(
    prompt: string,
    options: CCOptions & PromptConfig
  ): Promise<CCResult> {
    try {
      // Resolve worktree configuration
      if (!options.worktree) {
        throw new Error('Worktree option is required but not provided');
      }
      const worktreeConfig = this.resolveWorktreeConfig(options.worktree);

      // Ensure worktree exists
      const worktreeInfo = await this.worktreeManager.ensureWorktree(
        worktreeConfig.branch,
        worktreeConfig
      );

      // Execute within worktree context
      return await this.worktreeManager.executeInWorktree(worktreeInfo, async () => {
        // Create new options without worktree to avoid infinite recursion
        const { worktree: _, ...executeOptions } = options;

        // Check if we also need Docker within the worktree
        if (options.docker) {
          return this.executeDetachedInDocker(prompt, executeOptions);
        }

        // Regular detached execution within worktree
        return this.executeDetachedBase(prompt, executeOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `Worktree detached execution failed: ${error}`,
      };
    }
  }

  /**
   * Execute detached in Docker context
   */
  private async executeDetachedInDocker(
    prompt: string,
    options: CCOptions & PromptConfig
  ): Promise<CCResult> {
    try {
      // Check if Docker is available
      if (!(await this.dockerManager.checkDockerAvailable())) {
        return {
          success: false,
          error: 'Docker not found. Please install Docker to use Docker mode.',
        };
      }

      // Resolve Docker configuration
      const dockerConfig = await this.dockerManager.resolveDockerConfig(options.docker || true);

      // Build image if needed
      if (dockerConfig.needsBuild && dockerConfig.dockerfilePath) {
        const imageExists = await this.dockerManager.imageExists(dockerConfig.image);
        if (!imageExists) {
          console.log(`Building Docker image: ${dockerConfig.image}...`);
          await this.dockerManager.buildImage(dockerConfig.dockerfilePath, dockerConfig.image);
          console.log('Docker image built successfully.');
        }
      }

      // Build Docker args for detached mode
      const dockerArgs = this.dockerManager.buildDockerArgs(dockerConfig, false);

      // Add detached flag to Docker
      dockerArgs.unshift('-d'); // Run container in detached mode

      // Build Claude command args
      const detachedOptions = { ...options };
      if (options.stream) {
        detachedOptions.outputFormat = 'stream-json';
      }

      const claudeCmd = await this.buildCommand(detachedOptions);
      const claudeArgs = claudeCmd.slice(1); // Remove 'claude' from args

      // Combine Docker and Claude args
      const fullArgs = [...dockerArgs, 'claude', ...claudeArgs];

      // Set up stdio for log file if provided
      const stdio: 'pipe' | 'inherit' = 'pipe';

      const { spawn } = await import('node:child_process');
      const proc = spawn('docker', fullArgs, {
        stdio: [stdio, 'pipe', 'pipe'],
      });

      // Write prompt to stdin
      if (proc.stdin && !options.resume && !options.continue) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }

      // Capture container ID from stdout
      let containerId = '';
      if (proc.stdout) {
        proc.stdout.on('data', (chunk) => {
          containerId += chunk.toString().trim();
        });
      }

      // Wait for Docker to start the container
      await new Promise<void>((resolve, reject) => {
        proc.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Docker failed with exit code ${code}`));
          }
        });
        proc.on('error', reject);
      });

      return {
        success: true,
        data: {
          containerId: containerId.substring(0, 12), // Short container ID
          detached: true,
          docker: true,
          logFile: options.logFile,
          streaming: options.stream || false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker detached execution failed: ${error}`,
      };
    }
  }
}
