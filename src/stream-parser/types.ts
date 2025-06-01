/**
 * Type definitions for Claude's stream-json format
 */

// Event types from Claude's stream-json format

/**
 * System initialization event
 */
export interface SystemEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools?: string[];
  mcp_servers?: Array<{
    name: string;
    status: string;
  }>;
}

/**
 * Assistant message event
 */
export interface AssistantEvent {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: Array<{
      type: 'text';
      text: string;
    }>;
    stop_reason: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      service_tier?: string;
    };
    ttftMs?: number;
  };
  session_id: string;
}

/**
 * Final result event
 */
export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  cost_usd: number;
  total_cost: number;
  duration_ms: number;
  duration_api_ms?: number;
  num_turns: number;
  result?: string;
  error?: string;
  is_error: boolean;
  session_id: string;
}

/**
 * Tool use event
 */
export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  // biome-ignore lint/suspicious/noExplicitAny: Tool inputs can be any valid JSON structure from Claude
  input: any;
  session_id: string;
  timestamp?: number;
}

/**
 * Tool result event
 */
export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  // biome-ignore lint/suspicious/noExplicitAny: Tool outputs can be any valid JSON structure from Claude
  output: any;
  session_id: string;
  timestamp?: number;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  error: string;
  code?: string;
  session_id?: string;
}

/**
 * Union of all Claude event types
 */
export type ClaudeEvent =
  | SystemEvent
  | AssistantEvent
  | ResultEvent
  | ToolUseEvent
  | ToolResultEvent
  | ErrorEvent;

/**
 * Simplified chunk for backward compatibility with existing SDK
 */
export interface StreamChunk {
  type: 'content' | 'error' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
  tool?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Event metadata can contain arbitrary data from Claude
  metadata?: Record<string, any>;
}

/**
 * Conversation message
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Parsed log file result
 */
export interface ParsedLog {
  /**
   * All events in the log file
   */
  events: ClaudeEvent[];

  /**
   * Simplified chunks (for backward compatibility)
   */
  chunks: StreamChunk[];

  /**
   * Session ID extracted from events
   */
  sessionId?: string;

  /**
   * Concatenated assistant messages
   */
  content: string;

  /**
   * Structured conversation history
   */
  messages: Message[];

  /**
   * Metadata extracted from events
   */
  metadata: {
    totalCost?: number;
    duration?: number;
    turns?: number;
    model?: string;
    toolsUsed?: string[];
  };
}

/**
 * Type guard functions
 */
export function isSystemEvent(event: ClaudeEvent): event is SystemEvent {
  return event.type === 'system';
}

export function isAssistantEvent(event: ClaudeEvent): event is AssistantEvent {
  return event.type === 'assistant';
}

export function isResultEvent(event: ClaudeEvent): event is ResultEvent {
  return event.type === 'result';
}

export function isToolUseEvent(event: ClaudeEvent): event is ToolUseEvent {
  return event.type === 'tool_use';
}

export function isToolResultEvent(event: ClaudeEvent): event is ToolResultEvent {
  return event.type === 'tool_result';
}

export function isErrorEvent(event: ClaudeEvent): event is ErrorEvent {
  return event.type === 'error';
}
