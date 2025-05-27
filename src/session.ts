import type { CCResult } from './types.js';
import type { ClaudeFunction, ClaudeOptions } from './functions.js';
import { claude as claudeBase, stream as streamBase, interactive as interactiveBase, run as runBase } from './functions.js';
import { FileSessionStorage } from './session-storage.js';

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
  sessionChain: string[];         // All session IDs in order
  currentSessionId?: string;      // Latest session ID
  
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
  
  // Essential session methods
  id(): string | undefined;              // Get current session ID
  messages(): Message[];                 // Get conversation history
  save(name?: string): Promise<string>;  // Save session
  clear(): void;                        // Clear session
}

/**
 * SessionManager handles session state and conversation tracking
 */
export class SessionManager {
  private state: SessionState;
  private storage?: SessionStorage;

  constructor(options?: SessionOptions) {
    this.storage = options?.storage;
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
  static async load(
    nameOrPath: string,
    storage: SessionStorage
  ): Promise<SessionManager> {
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
      }
    }
    
    return result;
  }

  /**
   * Execute stream function with session context
   */
  async *streamWithSession(
    prompt: string,
    options?: ClaudeOptions
  ): AsyncIterable<any> {
    // Use latest session ID from chain
    const resumeId = this.state.sessionChain[this.state.sessionChain.length - 1];
    
    // Track user message before streaming
    const tempSessionId = resumeId || 'pending';
    this.addMessage('user', prompt, tempSessionId);
    
    // Stream with session context
    const chunks: string[] = [];
    for await (const chunk of streamBase(prompt, {
      ...options,
      resume: resumeId || options?.resume,
    })) {
      chunks.push(chunk.content);
      yield chunk;
    }
    
    // After streaming, try to extract session ID and update message
    const fullContent = chunks.join('');
    if (fullContent) {
      this.addMessage('assistant', fullContent, tempSessionId);
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
      return (result.data as any).sessionId;
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
    const manager = this;
    
    return {
      // Wrapped claude function
      claude: ((promptOrFileOrStrings: any, ...args: any[]) => {
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
          return manager.executeWithSession(claudeBase as any, prompt, {});
        }
        
        // Regular function call
        return manager.executeWithSession(
          claudeBase as any,
          promptOrFileOrStrings,
          args[0]
        );
      }) as ClaudeFunction,
      
      // Wrapped stream function
      stream: (prompt: string, options?: ClaudeOptions) => {
        return manager.streamWithSession(prompt, options);
      },
      
      // Wrapped interactive function
      interactive: async (prompt: string, options?: ClaudeOptions) => {
        const resumeId = manager.state.sessionChain[manager.state.sessionChain.length - 1];
        return interactiveBase(prompt, {
          ...options,
          resume: resumeId || options?.resume,
        });
      },
      
      // Wrapped run function
      run: async (prompt: string, options?: ClaudeOptions) => {
        return manager.executeWithSession(runBase, prompt, options);
      },
      
      // Session methods
      id: () => manager.getCurrentId(),
      messages: () => manager.getMessages(),
      save: (name?: string) => manager.save(name),
      clear: () => manager.clear(),
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
session.load = async function(
  nameOrPath: string,
  storage?: SessionStorage
): Promise<Session> {
  const storageImpl = storage || new FileSessionStorage();
  const manager = await SessionManager.load(nameOrPath, storageImpl);
  return manager.createSessionInterface();
};

/**
 * List saved sessions
 */
session.list = async function(storage?: SessionStorage): Promise<SessionInfo[]> {
  const storageImpl = storage || new FileSessionStorage();
  return storageImpl.list();
};