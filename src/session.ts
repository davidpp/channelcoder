import type { ClaudeFunction, ClaudeOptions } from './functions.js';
import {
  claude as claudeBase,
  detached as detachedBase,
  interactive as interactiveBase,
  run as runBase,
  stream as streamBase,
} from './functions.js';
import { FileSessionStorage } from './session-storage.js';
import type { CCResult, StreamChunk } from './types.js';

/**
 * Message in a conversation
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
}

/**
 * Session state that can be saved/loaded
 */
export interface SessionState {
  // Claude CLI session chain
  sessionChain: string[]; // All session IDs in order
  currentSessionId?: string; // Latest session ID

  // Conversation history
  messages: Message[];

  // Metadata
  metadata: {
    name?: string;
    created: Date;
    lastActive: Date;
  };
}

/**
 * Session information for listing
 */
export interface SessionInfo {
  name: string;
  path: string;
  created: Date;
  lastActive: Date;
  messageCount: number;
}

/**
 * Options for creating a session
 */
export interface SessionOptions {
  name?: string;
  storage?: SessionStorage;
  autoSave?: boolean; // Enable real-time session file updates (default: true)
  cwd?: string; // Working directory for git operations (defaults to process.cwd())
}

/**
 * Storage interface for sessions
 */
export interface SessionStorage {
  save(state: SessionState, name?: string): Promise<string>;
  load(nameOrPath: string): Promise<SessionState>;
  list(): Promise<SessionInfo[]>;
}

/**
 * Session interface with wrapped functions and management methods
 */
export interface Session {
  // Wrapped functions with session context
  claude: ClaudeFunction;
  stream: typeof streamBase;
  interactive: typeof interactiveBase;
  run: typeof runBase;
  detached: typeof detachedBase;

  // Essential session methods
  id(): string | undefined; // Get current session ID
  messages(): Message[]; // Get conversation history
  save(name?: string): Promise<string>; // Save session
  clear(): void; // Clear session
}

/**
 * SessionManager handles session state and conversation tracking
 */
export class SessionManager {
  private state: SessionState;
  private storage?: SessionStorage;
  private autoSave: boolean;
  private cwd?: string;

  constructor(options?: SessionOptions) {
    this.storage = options?.storage;
    this.autoSave = options?.autoSave ?? true; // Default to true
    this.cwd = options?.cwd;
    this.state = {
      sessionChain: [],
      messages: [],
      metadata: {
        name: options?.name,
        created: new Date(),
        lastActive: new Date(),
      },
    };
  }

  /**
   * Load session from storage
   */
  static async load(nameOrPath: string, storage: SessionStorage): Promise<SessionManager> {
    const state = await storage.load(nameOrPath);
    const manager = new SessionManager();
    manager.state = state;
    manager.storage = storage;
    return manager;
  }

  /**
   * Get current session ID (latest in chain)
   */
  getCurrentId(): string | undefined {
    return this.state.currentSessionId;
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return [...this.state.messages];
  }

  /**
   * Add a message to history
   */
  private addMessage(role: 'user' | 'assistant', content: string, sessionId: string) {
    this.state.messages.push({
      role,
      content,
      timestamp: new Date(),
      sessionId,
    });
    this.state.metadata.lastActive = new Date();
  }

  /**
   * Update the last message content (for streaming updates)
   */
  private updateLastMessage(role: 'user' | 'assistant', content: string, sessionId: string) {
    const lastMessage = this.state.messages[this.state.messages.length - 1];
    if (lastMessage && lastMessage.role === role && lastMessage.sessionId === sessionId) {
      lastMessage.content = content;
      lastMessage.timestamp = new Date();
    } else {
      // No matching last message, add new one
      this.addMessage(role, content, sessionId);
    }
    this.state.metadata.lastActive = new Date();
  }

  /**
   * Save session state (internal method with error handling)
   */
  private async saveState(): Promise<void> {
    if (this.storage && this.autoSave) {
      try {
        await this.storage.save(this.state, this.state.metadata.name);
      } catch (error) {
        // Silently ignore save errors to avoid disrupting the main flow
        console.warn('Session auto-save failed:', error);
      }
    }
  }

  /**
   * Execute a function with session context
   */
  async executeWithSession<T>(
    fn: (prompt: string, options?: ClaudeOptions) => Promise<CCResult<T>>,
    prompt: string,
    options?: ClaudeOptions
  ): Promise<CCResult<T>> {
    // Use latest session ID from chain
    const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];

    // Execute with session context
    const result = await fn(prompt, {
      ...options,
      resume: resumeId || options?.resume,
      cwd: options?.cwd || this.cwd,
    });

    // Extract session ID from response
    if (result.success) {
      // Parse session ID from Claude's response
      // Claude CLI typically returns session ID in stderr or structured output
      const sessionId = this.extractSessionId(result);

      if (sessionId) {
        this.state.sessionChain.push(sessionId);
        this.state.currentSessionId = sessionId;

        // Track messages
        this.addMessage('user', prompt, sessionId);
        if (typeof result.data === 'string') {
          this.addMessage('assistant', result.data, sessionId);
        }

        // Auto-save session state after updates
        await this.saveState();
      }
    }

    return result;
  }

  /**
   * Execute stream function with session context
   */
  async *streamWithSession(prompt: string, options?: ClaudeOptions): AsyncIterable<StreamChunk> {
    // Use latest session ID from chain
    const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];

    // Track user message before streaming
    const tempSessionId = resumeId || 'pending';
    this.addMessage('user', prompt, tempSessionId);

    // Auto-save user message
    await this.saveState();

    // Stream with session context and real-time updates
    let assistantContent = '';
    for await (const chunk of streamBase(prompt, {
      ...options,
      resume: resumeId || options?.resume,
      cwd: options?.cwd || this.cwd,
    })) {
      // Accumulate assistant content
      assistantContent += chunk.content;

      // Update session with partial content in real-time
      this.updateLastMessage('assistant', assistantContent, tempSessionId);

      // Auto-save session state with each chunk
      await this.saveState();

      yield chunk;
    }
  }

  /**
   * Extract session ID from Claude response
   * This needs to be implemented based on Claude CLI's actual output format
   */
  private extractSessionId(result: CCResult): string | undefined {
    // Check if session ID was already extracted by process.ts
    if (result.sessionId) {
      return result.sessionId;
    }

    // Check stderr for session ID pattern
    if (result.stderr) {
      const match = result.stderr.match(/Session ID: ([a-zA-Z0-9-]+)/);
      if (match) return match[1];
    }

    // Check if response data contains session ID
    if (typeof result.data === 'object' && result.data && 'sessionId' in result.data) {
      return (result.data as { sessionId: string }).sessionId;
    }

    return undefined;
  }

  /**
   * Save session state
   */
  async save(name?: string): Promise<string> {
    if (!this.storage) {
      throw new Error('No storage configured for session');
    }

    this.state.metadata.name = name || this.state.metadata.name;
    return this.storage.save(this.state, name);
  }

  /**
   * Clear session state
   */
  clear(): void {
    this.state = {
      sessionChain: [],
      messages: [],
      metadata: {
        name: this.state.metadata.name,
        created: new Date(),
        lastActive: new Date(),
      },
    };
  }

  /**
   * Create session interface
   */
  createSessionInterface(): Session {
    return {
      // Wrapped claude function
      claude: ((promptOrFileOrStrings: string | TemplateStringsArray, ...args: unknown[]) => {
        // Handle template literal syntax
        if (Array.isArray(promptOrFileOrStrings) && 'raw' in promptOrFileOrStrings) {
          // Combine template strings
          let prompt = '';
          promptOrFileOrStrings.forEach((str: string, i: number) => {
            prompt += str;
            if (i < args.length) {
              prompt += String(args[i]);
            }
          });
          return this.executeWithSession(
            (p: string, o?: ClaudeOptions) => claudeBase(p, o),
            prompt,
            {}
          );
        }

        // Regular function call
        return this.executeWithSession(
          (p: string, o?: ClaudeOptions) => claudeBase(p, o),
          promptOrFileOrStrings as string,
          args[0] as ClaudeOptions | undefined
        );
      }) as ClaudeFunction,

      // Wrapped stream function
      stream: (prompt: string, options?: ClaudeOptions) => {
        return this.streamWithSession(prompt, options);
      },

      // Wrapped interactive function
      interactive: async (prompt: string, options?: ClaudeOptions) => {
        const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];
        if (options?.verbose) {
          console.log('Session resuming with ID:', resumeId);
        }
        return interactiveBase(prompt, {
          ...options,
          resume: resumeId || options?.resume,
          cwd: options?.cwd || this.cwd,
        });
      },

      // Wrapped run function
      run: async (prompt: string, options?: ClaudeOptions) => {
        return this.executeWithSession(runBase, prompt, options);
      },

      // Wrapped detached function
      detached: async (prompt: string, options?: ClaudeOptions) => {
        const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];
        const result = await detachedBase(prompt, {
          ...options,
          resume: resumeId || options?.resume,
        });

        // Track the detached session start
        if (result.success) {
          // Use existing session ID or generate a temporary one for tracking
          const sessionId = resumeId || this.state.currentSessionId || `detached-${Date.now()}`;
          this.addMessage('user', prompt, sessionId);

          // Update session chain if we don't have a session ID yet
          if (!this.state.currentSessionId) {
            this.state.sessionChain.push(sessionId);
            this.state.currentSessionId = sessionId;
          }

          await this.saveState();
        }

        return result;
      },

      // Session methods
      id: () => this.getCurrentId(),
      messages: () => this.getMessages(),
      save: (name?: string) => this.save(name),
      clear: () => this.clear(),
    };
  }
}

/**
 * Create a new session with wrapped functions
 */
export function session(options?: SessionOptions): Session {
  const storage = options?.storage || new FileSessionStorage();
  const manager = new SessionManager({ ...options, storage });
  return manager.createSessionInterface();
}

/**
 * Load an existing session
 */
session.load = async (nameOrPath: string, storage?: SessionStorage): Promise<Session> => {
  const storageImpl = storage || new FileSessionStorage();
  const manager = await SessionManager.load(nameOrPath, storageImpl);
  return manager.createSessionInterface();
};

/**
 * List saved sessions
 */
session.list = async (storage?: SessionStorage): Promise<SessionInfo[]> => {
  const storageImpl = storage || new FileSessionStorage();
  return storageImpl.list();
};
