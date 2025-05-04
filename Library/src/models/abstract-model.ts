import Browser from 'webextension-polyfill';
import { v4 as uuid } from 'uuid';
import {
  AIModel,
  SendMessageOptions,
  ChatThread,
  ChatMessage,
  AIModelError,
  StatusEvent,
  ErrorCode,
} from './types';

/**
 * Abstract base class for all AI models
 */
export abstract class AbstractModel implements AIModel {
  protected currentThread?: ChatThread;
  private static readonly THREADS_STORAGE_KEY = 'chat_threads';
  /**
  * Get the name of the AI model
  */
  abstract getName(): string;

  /**
   * Check if the model supports image input
   */
  abstract supportsImageInput(): boolean;

  /**
   * Send a message to the AI model and get a response
   * @param prompt The message to send
   * @param options Additional options for the request
   */
  async sendMessage(prompt: string, options: SendMessageOptions = { onEvent: () => { } }): Promise<string> {
    try {
      let fullResponse = '';
      // let fullReasoning = '';
      // Pass options.images instead of options.image
      await this.doSendMessage({
        prompt,
        images: options.images, // <-- FIX: Use images array
        signal: options.signal,
        mode: options.mode,
        model: options.model,
        style_key: options.style_key,
        searchFocus: options.searchFocus,
        searchSources: options.searchSources,
        searchEnabled: options.searchEnabled,
        onEvent: (event) => {
          if (event.type === 'UPDATE_ANSWER') {
            fullResponse = event.data.text;
            // fullReasoning = event.data.reasoningContent || '';
            // options.onEvent({ type: 'UPDATE_ANSWER', data: { text: fullResponse , reasoningContent: fullReasoning } });
            options.onEvent({ type: 'UPDATE_ANSWER', data: event.data });
          }
          if (event.type === 'DONE') {
            options.onEvent({ type: 'DONE', data: event.data });
          }
          if (event.type === 'SUGGESTED_RESPONSES') {
            options.onEvent({ type: 'SUGGESTED_RESPONSES', data: event.data });
          }
          if (event.type === 'TITLE_UPDATE') {
            options.onEvent({ type: 'TITLE_UPDATE', data: event.data });
          }
          // Propagate ERROR events too
          if (event.type === 'ERROR') {
            options.onEvent({ type: 'ERROR', error: event.error });
          }
        }
      });

      return fullResponse;
    } catch (error) {
      // Use the standardized handleModelError method for consistent error handling
      // First send the ERROR event directly since handleModelError will throw
      options.onEvent({
        type: 'ERROR',
        error: error instanceof AIModelError ? error : new AIModelError(
          error instanceof Error ? error.message : String(error),
          error instanceof AIModelError ? error.code : ErrorCode.UNKNOWN_ERROR
        )
      });

      // Then use handleModelError which will properly format and throw the error
      this.handleModelError(
        'Error sending message',
        error instanceof AIModelError ? error.code : undefined,
        options,
        error
      );
    }
  }

  /**
   * Reset the conversation history
   */
  abstract initNewThread(): Promise<void>;

  /**
   * Internal method to send a message to the AI model
   * @param params Parameters for sending a message
   */

  // Update signature to accept images array
  protected abstract doSendMessage(params: {
    prompt: string;
    images?: File[]; // <-- FIX: Update signature to use images array
    signal?: AbortSignal;
    mode?: string;
    model?: string;
    style_key?: string;
    searchFocus?: string;
    searchSources?: string[];
    searchEnabled?: boolean;
    onEvent: (event: StatusEvent) => void;
  }): Promise<void>;

  async getAllThreads(): Promise<ChatThread[]> {
    try {
      const result = await Browser.storage.local.get(AbstractModel.THREADS_STORAGE_KEY);
      return result[AbstractModel.THREADS_STORAGE_KEY] || [];
    } catch (error) {
      console.error('Failed to load threads from storage:', error);
      return [];
    }
  }

  protected async saveThreadsToStorage(threads: ChatThread[]): Promise<void> {
    try {
      await Browser.storage.local.set({ [AbstractModel.THREADS_STORAGE_KEY]: threads });
    } catch (error) {
      console.error('Failed to save threads to storage:', error);
    }
  }

  getCurrentThread(): ChatThread | undefined {
    return this.currentThread;
  }

  async loadThread(threadId: string): Promise<void> {
    const threads = await this.getAllThreads();
    const thread = threads.find(t => t.id === threadId);
    if (!thread) {
      return this.handleModelError('Thread not found', ErrorCode.INVALID_THREAD_ID);
    }
    this.currentThread = thread;
  }

  async saveThread(): Promise<void> {
    if (!this.currentThread) {
      return this.handleModelError('No active thread to save', ErrorCode.INVALID_REQUEST);
    }

    const threads = await this.getAllThreads();
    const existingIndex = threads.findIndex(t => t.id === this.currentThread!.id);

    if (existingIndex !== -1) {
      threads[existingIndex] = this.currentThread;
    } else {
      threads.push(this.currentThread);
    }

    await this.saveThreadsToStorage(threads);
  }

  async deleteThread(threadId: string, createNewThreadAfterDelete: boolean = true): Promise<void> {
    const threads = await this.getAllThreads();
    await this.saveThreadsToStorage(threads.filter(t => t.id !== threadId));

    if (this.currentThread?.id === threadId && createNewThreadAfterDelete) {
      this.initNewThread();
    }
  }

  protected createMessage(role: ChatMessage['role'], content: string): ChatMessage {
    return {
      id: uuid(),
      role,
      content,
      timestamp: Date.now()
    };
  }


  /**
   * The base URL for the AI service
   */
  protected baseUrl: string = '';
  protected models: any;
  protected defaultModel: string = '';

  /**
   * Get the base URL for the AI service
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Helper method to handle errors in a consistent way across all models
   *
   * This method:
   * 1. Creates a properly formatted AIModelError with appropriate error code
   * 2. Sends an ERROR event to the client if params.onEvent is provided
   * 3. Logs the error for debugging
   * 4. Throws the AIModelError
   *
   * @param errDesc A description of the error situation
   * @param errorCode The error code to use (will try to infer from original error if not provided)
   * @param params Optional - The original parameters with onEvent callback
   * @param originalError Optional - The original error that occurred
   * @returns Never returns - always throws an AIModelError
   */
  protected handleModelError(
    errDesc: string,
    errorCode?: ErrorCode,
    params?: { onEvent: (event: StatusEvent) => void },
    originalError?: unknown,
  ): never {
    // Try to infer a better error code from the original error if none was provided
    if (!errorCode && originalError instanceof AIModelError) {
      errorCode = originalError.code;
    } else if (!errorCode) {
      // Check for common error patterns
      if (originalError instanceof Error) {
        if (originalError.name === 'AbortError') {
          errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
        } else if (originalError.message.includes('network') || originalError.message.includes('connection')) {
          errorCode = ErrorCode.NETWORK_ERROR;
        } else if (originalError.message.includes('permission') || originalError.message.includes('unauthorized')) {
          errorCode = ErrorCode.UNAUTHORIZED;
        } else if (originalError.message.includes('timeout')) {
          errorCode = ErrorCode.SERVICE_UNAVAILABLE;
        }
      }
      // Default if we couldn't infer anything better
      errorCode = errorCode || ErrorCode.UNKNOWN_ERROR;
    }

    // Extract message from original error if available
    const originalMessage = originalError ?
      (originalError instanceof Error ? originalError.message : String(originalError))
      : '';

    // Create a well-formatted error message
    const combinedMessage = originalMessage
      ? `${originalMessage} - ${errDesc}`
      : errDesc;

    // Create the AIModelError with the original error as the cause
    const modelError = new AIModelError(
      combinedMessage,
      errorCode
    );

    // Set the cause property if available in the environment
    if (originalError && 'cause' in Error) {
      // Use Object.assign to avoid TypeScript errors with cause property
      Object.assign(modelError, { cause: originalError });
    }

    // Send the ERROR event with properly formatted error if callback provided
    if (params?.onEvent) {
      params.onEvent({
        type: 'ERROR',
        error: modelError
      });
    }

    // Log the error for debugging
    console.error('AI model error:', modelError);

    // Always throw the error
    throw modelError;
  }


  /**
   * Share the current conversation and get a shareable URL
   * This is an optional method that models can implement if they support sharing
   * @param options Optional sharing options that may be model-specific
   * @returns A promise that resolves to a shareable URL
   */
  async shareConversation(options?: any): Promise<string> {
    return this.handleModelError(
      `Sharing is not supported by the ${this.getName()} model`,
      ErrorCode.FEATURE_NOT_SUPPORTED
    );
  }


}