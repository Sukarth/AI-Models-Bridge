export type StrPayload = {
  text: string
}

export type DoneEvent = {
  threadId: string
}
export type TitleData = {
  title: string
  threadId: string
}

export type SuggestedResponses = {
  suggestions: string[]
}

export type StatusEvent =
  | {
    type: 'UPDATE_ANSWER'
    data: StrPayload
  }
  | {
    type: 'DONE'
    data: DoneEvent
  }
  | {
    type: 'SUGGESTED_RESPONSES'
    data: SuggestedResponses
  }
  | {
    type: 'TITLE_UPDATE'
    data: TitleData
  }
  | {
    type: 'ERROR'
    error: AIModelError
  }


/**
 * Interface for all AI models
 */
export interface AIModel {
  /**
   * Get the name of the AI model
   */
  getName(): string;
  
  /**
   * Check if the model supports image input
   */
  supportsImageInput(): boolean;
  
  /**
   * Send a message to the AI model and get a response
   * @param prompt The message to send
   * @param options Additional options for the request
   */
  sendMessage(prompt: string, options?: SendMessageOptions): Promise<string>;
  
  /**
   * Reset the conversation history
   */
  initNewThread(): void;

  /**
   * Get the current conversation thread
   */
  getCurrentThread(): ChatThread | undefined;

  /**
   * Load a specific conversation thread
   */
  loadThread(threadId: string): Promise<void>;

  /**
   * Save the current conversation thread
   */
  saveThread(title?: string): Promise<void>;

  /**
   * Get all saved conversation threads
   */
  getAllThreads(): Promise<ChatThread[]>;

  /**
   * Delete a conversation thread
   */
  deleteThread(threadId: string): Promise<void>;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /**
   * Image to include with the message (if supported)
   */
  image?: File;
  
  /**
   * Signal to abort the request
   */
  signal?: AbortSignal;

  /**
   * Mode for the request
   */
  mode?: string; // 'chat' | 'reasoning'

  /**
   * Callback for handling events during the request
   * @param event - The event to handle
   */
  onEvent: (event: StatusEvent) => void;
}

/**
 * Error codes for AI model errors
 */
export enum ErrorCode {
  UNKNOWN_ERROR = 'unknown_error',
  NETWORK_ERROR = 'network_error',
  UNAUTHORIZED = 'unauthorized',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  MISSING_API_KEY = 'missing_api_key',
  MISSING_HOST_PERMISSION = 'missing_host_permission',
  CONVERSATION_LIMIT = 'conversation_limit',
  CONTENT_FILTERED = 'content_filtered',
  INVALID_REQUEST = 'invalid_request',
}

/**
 * Error class for AI model errors
 */
export class AIModelError extends Error {
  constructor(message: string, public code: ErrorCode = ErrorCode.UNKNOWN_ERROR) {
    super(message);
    this.name = 'AIModelError';
  }
}

/**
 * Represents a message in a conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Represents a conversation thread
 */
export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelName: string;
  metadata?: Record<string, any>;
}

/**
 * Base configuration interface that all model configs should extend
 */
export interface BaseModelConfig {
  /**
   * The base URL for the AI service
   */
  baseUrl?: string;
}