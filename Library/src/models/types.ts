export type updatePayload = {
  text: string;
  reasoningContent?: string; // optional reasoning content
  reasoningElapsedSecs?: number;
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
    data: updatePayload
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
   * Images to include with the message (if supported, max 4 for Perplexity)
   */
  images?: File[]; // Changed from image?: File
  
  /**
   * Signal to abort the request
   */
  signal?: AbortSignal;

  /**
   * Mode for the request
   */
  mode?: string; // 'chat' | 'reasoning'

  /**
   * Model type/version of the AI for the request
   */

  model?: string;


  /**
   * Response style metadata for some models
   */

  style_key?: string;

  /**
   * Internet search metadata for some models
   */
  searchFocus?: string;
  
  searchSources?: string[];

  searchEnabled?: boolean;

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
  INVALID_API_KEY = 'invalid_api_key',
  INVALID_THREAD_ID = 'invalid_thread_id',
  INVALID_METADATA = 'invalid_metadata',
  INVALID_MESSAGE_ID = 'invalid_message_id',
  INVALID_MODEL = 'invalid_model',
  // INVALID_IMAGE = 'invalid_image',
  // INVALID_IMAGE_URL = 'invalid_image_url',
  INVALID_IMAGE_TYPE = 'invalid_image_type',
  INVALID_IMAGE_CONTENT = 'invalid_image_content',
  UPLOAD_FAILED = 'upload_failed',
  UPLOAD_TIMEOUT = 'upload_timeout',
  UPLOAD_SIZE_EXCEEDED = 'upload_size_exceeded',
  UPLOAD_TYPE_EXCEEDED = 'upload_type_exceeded',
  UPLOAD_AMOUNT_EXCEEDED = 'upload_amount_exceeded',
  UPLOAD_TYPE_NOT_SUPPORTED = 'upload_type_not_supported',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  METADATA_INITIALIZATION_ERROR = 'metadata_initialization_error',
  FEATURE_NOT_SUPPORTED = 'feature_not_supported',
  RESPONSE_PARSING_ERROR = 'response_parsing_error',
  POW_CHALLENGE_FAILED = 'pow_challenge_failed',
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
  reasoningContent?: string; // For reasoning 
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

/**
 * Interface for standardized parsed model responses
 */
export interface ParsedModelResponse {
  text: string; // Final assistant message
  tokensUsed?: number;
  title?: string;
  updatedAt?: number;
  messageId?: string | number;
  parentId?: string | number;
  model?: string;
  role?: string;
  reasoningContent?: string; // For reasoning mode (was thinkingContent)
  reasoningElapsedSecs?: number;
  searchEnabled?: boolean;
  searchStatus?: any;
  searchResults?: any;
  files?: any[];
  tips?: any[];
  insertedAt?: number;
  status?: string;
  error?: AIModelError;
  [key: string]: any; // For future extensibility
}