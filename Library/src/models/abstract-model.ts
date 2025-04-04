import Browser from 'webextension-polyfill';
import { v4 as uuid } from 'uuid';
import { 
  AIModel,
  SendMessageOptions,
  ChatThread, 
  ChatMessage,  
  AIModelError,
  StatusEvent, 
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
  async sendMessage(prompt: string, options: SendMessageOptions = { onEvent: () => {} }): Promise<string> {
    try {
      let fullResponse = '';
      
      await this.doSendMessage({
        prompt,
        image: options.image,
        signal: options.signal,
        mode: options.mode,
        onEvent: (event) => {
          if (event.type === 'UPDATE_ANSWER') {
            fullResponse = event.data.text;
            options.onEvent({ type: 'UPDATE_ANSWER', data: { text: fullResponse } });
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
        }
      });
      
      return fullResponse;
    } catch (error) {
      if (error instanceof AIModelError) {
        throw error;
      }
      
      throw new AIModelError(
        error instanceof Error ? error.message : String(error)
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
  
  protected abstract doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    mode?: string;
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
      throw new Error('Thread not found');
    }
    this.currentThread = thread;
  }

  async saveThread(): Promise<void> {
    if (!this.currentThread) {
      throw new Error('No active thread to save');
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

  async deleteThread(threadId: string): Promise<void> {
    const threads = await this.getAllThreads();
    await this.saveThreadsToStorage(threads.filter(t => t.id !== threadId));
    
    if (this.currentThread?.id === threadId) {
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
  
  /**
   * Get the base URL for the AI service
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
  
}