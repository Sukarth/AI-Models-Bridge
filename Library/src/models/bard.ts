import { ofetch } from 'ofetch';
import { v4 as uuid } from 'uuid';
import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode, StatusEvent } from './types';


interface BardThreadMetadata {
  contextIds: [string, string, string];
  requestParams: {
    atValue: string;
    blValue: string;
  };
}


// Helper functions
function generateReqId() {
  return Math.floor(Math.random() * 900000) + 100000;
}
function extractFromHTML(variableName: string, html: string) {
  const regex = new RegExp(`"${variableName}":"([^"]+)"`)
  const match = regex.exec(html)
  return match?.[1]
}

export class BardModel extends AbstractModel {
  constructor() {
    super();
    // Initialize storage and validate threads
    this.initializeStorage().catch(console.error);
  }

  private async initializeStorage(): Promise<void> {
    // Ensure threads storage exists
    const threads = await this.getAllThreads();
    if (!threads.length) {
      await this.saveThreadsToStorage([]);
    }
    await this.validateExistingThreads();
  }

  private async validateExistingThreads(): Promise<void> {
    const threads = await this.getAllThreads();
    let hasChanges = false;

    for (const thread of threads) {
      if (thread.modelName === this.getName() && !this.isValidBardMetadata(thread.metadata)) {
        await this.deleteThread(thread.id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.saveThreadsToStorage(threads.filter(t =>
        t.modelName !== this.getName() || this.isValidBardMetadata(t.metadata)
      ));
    }
  }

  private isValidBardMetadata(metadata: any): metadata is BardThreadMetadata {
    return metadata?.contextIds && metadata?.requestParams;
  }


  getName(): string {
    return 'Google Bard';
  }

  supportsImageInput(): boolean {
    return true;
  }

 
  private async fetchRequestParams(): Promise<{ atValue: string; blValue: string }> {
    try {
      const response = await ofetch('https://gemini.google.com/', {
        responseType: 'text'
      });

      const atValue = extractFromHTML('SNlM0e', response);
      const blValue = extractFromHTML('cfb2h', response);

      if (!atValue || !blValue) {
        throw new AIModelError('Failed to extract Bard parameters', ErrorCode.UNAUTHORIZED);
      }

      return { atValue, blValue };
    } catch (error) {
      throw new AIModelError(
        'Failed to initialize Bard session',
        ErrorCode.UNAUTHORIZED
      );
    }
  }

  // KEEP: Response parsing with image support
  private parseBardResponse(responseText: string): { text: string; ids: [string, string, string] } {
    try {
      const lines = responseText.split('\n');
      const jsonPart = lines.find(line => line.startsWith('['));
      
      if (!jsonPart) {
        throw new Error('Invalid response format');
      }

      const data = JSON.parse(jsonPart);
      const payload = JSON.parse(data[0][2]);

      if (!payload) {
        throw new Error('Empty response data');
      }

      const text = payload[4][0][1][0];
      const ids: [string, string, string] = [
        payload[1][0], // conversationId
        payload[1][1], // responseId
        payload[4][0][0], // choiceId
      ];

      const images = payload[4][0][4] || [];
      let processedText = text;
      
      for (const image of images) {
        const [media, source, placeholder] = image;
        processedText = processedText.replace(placeholder, `[![${media[4]}](${media[0][0]})](${source[0][0]})`);
      }

      return { text: processedText, ids };
    } catch (error) {
      console.error('Error parsing Bard response:', error);
      throw new AIModelError('Failed to parse Bard response', ErrorCode.UNKNOWN_ERROR);
    }
  }

  // KEEP: Image upload functionality
  private async uploadImage(image: File): Promise<string> {
    const headers = {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'push-id': 'feeds/mcudyrk2a4khkz',
      'x-goog-upload-header-content-length': image.size.toString(),
      'x-goog-upload-protocol': 'resumable',
      'x-tenant-id': 'bard-storage',
    };

    const resp = await ofetch.raw('https://content-push.googleapis.com/upload/', {
      method: 'POST',
      headers: {
        ...headers,
        'x-goog-upload-command': 'start',
      },
      body: new URLSearchParams({ [`File name: ${image.name}`]: '' }),
    });

    const uploadUrl = resp.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new AIModelError('Failed to upload image', ErrorCode.UNKNOWN_ERROR);
    }

    const uploadResult = await ofetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'x-goog-upload-command': 'upload, finalize',
        'x-goog-upload-offset': '0',
      },
      body: image,
    });

    return uploadResult as string;
  }

  // UPDATE: Main message handling method to use thread system
  // Add this method to properly retrieve the thread from storage before each request
  private async ensureThreadLoaded(): Promise<void> {
    if (!this.currentThread) {
      // Try to load the most recent thread for this model
      const threads = await this.getAllThreads();
      const bardThreads = threads.filter(t => 
        t.modelName === this.getName() && this.isValidBardMetadata(t.metadata)
      );
      
      if (bardThreads.length > 0) {
        // Sort by most recent and use that thread
        const mostRecentThread = bardThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        this.currentThread = mostRecentThread;
        console.log('Loaded existing thread from storage:', this.currentThread.id);
      } else {
        // Create a new thread if none exists
        await this.initNewThread();
      }
    }
  }

  // Update doSendMessage to use the ensureThreadLoaded method
  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: StatusEvent) => void;
  }): Promise<void> {
    try {
      params.onEvent({
        type: 'UPDATE_ANSWER',
        data: { text: '' }
      });

      // Make sure we have a valid thread with the latest data from storage
      await this.ensureThreadLoaded();

      // Now we can safely assert that currentThread exists
      const currentThread = this.getCurrentThreadSafe();

      // Add user message
      const userMessage = this.createMessage('user', params.prompt);
      currentThread.messages.push(userMessage);

      // Get Bard-specific metadata
      const metadata = this.getBardMetadata();
      
      // IMPORTANT: Log the context IDs to verify they're being retrieved correctly
      console.log('Current context IDs before request:', metadata.contextIds);
      
      // Handle image upload
      let imageUrl: string | undefined;
      if (params.image) {
        imageUrl = await this.uploadImage(params.image);
      }

      const payload = [
        null,
        JSON.stringify([
          [params.prompt, 0, null, imageUrl ? [[[imageUrl, 1], params.image!.name]] : []],
          null,
          metadata.contextIds,
        ]),
      ];

      const resp = await ofetch(
        'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
        {
          method: 'POST',
          signal: params.signal,
          query: {
            bl: metadata.requestParams.blValue,
            _reqid: generateReqId(),
            rt: 'c',
          },
          body: new URLSearchParams({
            at: metadata.requestParams.atValue,
            'f.req': JSON.stringify(payload),
          }),
          parseResponse: (txt) => txt,
        },
      );

      const { text, ids } = this.parseBardResponse(resp);
      
      // Log the new context IDs
      console.log('New context IDs after response:', ids);
      
      // Update thread with assistant's response
      const assistantMessage = this.createMessage('assistant', text);
      assistantMessage.metadata = { messageId: ids[0] };
      currentThread.messages.push(assistantMessage);
      
      // Update thread metadata with new context IDs
      if (currentThread.metadata) {
        (currentThread.metadata as BardThreadMetadata).contextIds = ids;
      }
      currentThread.updatedAt = Date.now();
      
      // Save thread to storage - FIXED: Only save once using the proper method
      await this.saveThread();
      
      // REMOVED: The duplicate thread saving code that was causing duplicates
      // No longer loading all threads and saving again

      // Send events
      params.onEvent({
        type: 'UPDATE_ANSWER',
        data: { 
          text: text
        }
      });

      params.onEvent({ 
        type: 'DONE',
        data: {
          threadId: ids[1]
        }
        
       });
    } catch (error) {
      params.onEvent({
        type: 'ERROR',
          error: error instanceof AIModelError ? error : new AIModelError(
            error instanceof Error ? error.message : String(error),
            ErrorCode.NETWORK_ERROR
          )
      });
      throw error;
    }
  }

  // OVERRIDE: Thread loading to handle Bard session refresh
  async loadThread(threadId: string): Promise<void> {
    const threads = await this.getAllThreads();
    const thread = threads.find(t => t.id === threadId);
    
    if (thread && thread.modelName === this.getName()) {
      this.currentThread = thread;
      // Refresh Bard session
      const metadata = this.currentThread.metadata as BardThreadMetadata;
      metadata.requestParams = await this.fetchRequestParams();
      await this.saveThread();
      await this.saveThreadsToStorage(threads);
    }
  }

  private getBardMetadata(): BardThreadMetadata {
    const currentThread = this.getCurrentThreadSafe();
    
    if (!currentThread.metadata) {
      throw new AIModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
    }
    
    const metadata = currentThread.metadata as BardThreadMetadata;
    if (!metadata.contextIds || !metadata.requestParams) {
      throw new AIModelError('Invalid thread metadata', ErrorCode.INVALID_REQUEST);
    }
    
    return metadata;
  }

  private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
    if (!this.currentThread) {
      throw new AIModelError('No active thread', ErrorCode.INVALID_REQUEST);
    }
    return this.currentThread;
  }


  async initNewThread(): Promise<void> {
    this.currentThread = {
      id: uuid(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelName: this.getName(),
      metadata: {
        contextIds: ['', '', ''],
        requestParams: await this.fetchRequestParams()
      }
    };
    
    // FIXED: Only save once using the proper method
    await this.saveThread();
    // REMOVED: The duplicate thread saving code
  }

  // Add a new method to properly save the thread
  // Changed from protected to public to match parent class
  public async saveThread(): Promise<void> {
    if (!this.currentThread) return;
    
    // Load all threads
    const threads = await this.getAllThreads();
    
    // Find if this thread already exists
    const existingIndex = threads.findIndex(t => t.id === this.currentThread!.id);
    
    if (existingIndex !== -1) {
      // Update existing thread
      threads[existingIndex] = this.currentThread;
    } else {
      // Add new thread
      threads.push(this.currentThread);
    }
    
    // Save all threads
    await this.saveThreadsToStorage(threads);
  }
}