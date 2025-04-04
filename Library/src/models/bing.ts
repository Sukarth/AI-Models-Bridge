import { v4 as uuid } from 'uuid';
import WebSocket from 'isomorphic-ws';
import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode, StatusEvent} from './types';
import { requestHostPermission } from '../utils/permissions';
import { getCopilotAuth, AUTH_EVENTS } from '../utils/auth';

// Export AUTH_EVENTS for external use
export { AUTH_EVENTS };

// Bing-specific thread metadata
interface BingThreadMetadata {
  conversationId: string;
}

export class BingModel extends AbstractModel {
  constructor() {
    super();
    this.baseUrl = 'https://copilot.microsoft.com';
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
      if (thread.modelName === this.getName() && !this.isValidBingMetadata(thread.metadata)) {
        await this.deleteThread(thread.id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.saveThreadsToStorage(threads.filter(t =>
        t.modelName !== this.getName() || this.isValidBingMetadata(t.metadata)
      ));
    }
  }

  private isValidBingMetadata(metadata: any): metadata is BingThreadMetadata {
    return metadata?.conversationId;
  }

  getName(): string {
    return `Bing Copilot`;
  }

  supportsImageInput(): boolean {
    return true;
  }


  // Create a new conversation with Copilot
  // Update the createConversation method to use baseUrl
  // Update the createConversation method to use the auth token
  private async createConversation(): Promise<BingThreadMetadata> {
    try {
      // Check for permission first
      if (!(await requestHostPermission(`${this.baseUrl}/`))) {
        throw new AIModelError(`Missing ${this.baseUrl} permission`, ErrorCode.MISSING_HOST_PERMISSION);
      }
  
      // Get auth token
      const token = await getCopilotAuth();
      if (!token) {
        throw new AIModelError('Failed to get authorization token', ErrorCode.UNAUTHORIZED);
      }

      const response = await fetch(`${this.baseUrl}/c/api/start`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        // body: JSON.stringify({ "timeZone": "Europe/Helsinki", "startNewConversation": true, "teenSupportEnabled": true }),
        body: JSON.stringify({ "timeZone": Intl.DateTimeFormat().resolvedOptions().timeZone, "startNewConversation": true}),
        credentials: 'same-origin'
      });

      if (!response.ok) {
        // If unauthorized, try to refresh the token and retry once
        if (response.status === 401) {
          console.log('Token expired, refreshing...');
          const newToken = await getCopilotAuth(true); // Force refresh
          if (newToken) {
            return this.createConversation(); // Retry with new token
          }
        }
        throw new AIModelError(`Failed to create conversation: ${response.status}`, ErrorCode.SERVICE_UNAVAILABLE);
      }

      const data = await response.json();
      console.log('Copilot create conversation response:', data);

      if (!data.currentConversationId) {
        throw new AIModelError('Failed to create Copilot conversation', ErrorCode.SERVICE_UNAVAILABLE);
      }

      return {
        conversationId: data.currentConversationId
      };
  
    //   const response = await fetch(`${this.baseUrl}/c/api/conversations`, {
    //     method: 'POST',
    //     headers: {
    //       'accept': 'application/json',
    //       'accept-language': 'en-US,en;q=0.9',
    //       'content-type': 'application/json',
    //       'authorization': `Bearer ${token}`
    //     },
    //     body: JSON.stringify({}),
    //     credentials: 'include'
    //   });
  
    //   if (!response.ok) {
    //     // If unauthorized, try to refresh the token and retry once
    //     if (response.status === 401) {
    //       console.log('Token expired, refreshing...');
    //       const newToken = await getCopilotAuth(true); // Force refresh
    //       if (newToken) {
    //         return this.createConversation(); // Retry with new token
    //       }
    //     }
    //     throw new AIModelError(`Failed to create conversation: ${response.status}`, ErrorCode.SERVICE_UNAVAILABLE);
    //   }
  
    //   const data = await response.json();
    //   console.log('Copilot conversation response:', data);
  
    //   if (!data.id) {
    //     throw new AIModelError('Failed to create Copilot conversation', ErrorCode.SERVICE_UNAVAILABLE);
    //   }
  
    //   return {
    //     conversationId: data.id
    //   };
    } catch (error) {
      console.error('Error initializing Copilot session:', error);
      throw new AIModelError(
        'Failed to initialize Copilot session',
        ErrorCode.UNAUTHORIZED
      );
    }
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    mode?: string;
    onEvent: (event: StatusEvent) => void;
  }): Promise<void> {
    let ws: WebSocket | null = null;
    let closeTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      // Check for permission first
      if (!(await requestHostPermission(`wss://${new URL(this.baseUrl).hostname}/`))) {
        throw new AIModelError(`Missing ${this.baseUrl} permission`, ErrorCode.MISSING_HOST_PERMISSION);
      }

      // Debug the entire params object to see what's being received
      console.log('Full params received in doSendMessage:', JSON.stringify({
        prompt: params.prompt,
        hasImage: !!params.image,
        hasSignal: !!params.signal,
        hasOnEvent: !!params.onEvent,
        mode: params.mode
      }));

      // Validate mode parameter
      console.log('Received mode:', params.mode);
      let validatedMode = "chat"; // Default mode
      if (params.mode) {
        if (params.mode === "chat" || params.mode === "reasoning") {
          validatedMode = params.mode;
          console.log('Using validated mode:', validatedMode);
        } else {
          console.warn(`Invalid mode "${params.mode}" provided. Using default mode "chat" instead.`);
        }
      } else {
        console.log('No mode provided, using default "chat" mode');
      }

      // Initialize with empty response
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
      
      // If there's an image, store both the URL (for API) and dataURL (for display)
      if (params.image) {
        // Convert image to data URL for local storage
        const imageDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(params.image as Blob);
        });
        
        // Store image data in message metadata
        userMessage.metadata = {
          ...userMessage.metadata,
          imageDataUrl
        };
      }
      
      currentThread.messages.push(userMessage);

      // Save thread to storage immediately after adding user message
      await this.saveThread();

      // Get Bing-specific metadata
      const metadata = await this.getBingMetadata();

      // Handle image upload if provided
      let imageUrl: string | undefined;
      let fullUrl: string | undefined;
      if (params.image) {
        try {
          imageUrl = await this.uploadImage(params.image);
          fullUrl = this.baseUrl + imageUrl
          console.log('Image uploaded successfully:', fullUrl);
          
          // Update the message metadata with the remote URL as well
          userMessage.metadata = {
            ...userMessage.metadata,
            fullUrl
          };
          
          // Save thread again with the updated URL
          await this.saveThread();
        } catch (error) {
          console.error('Error uploading image:', error);
          throw new AIModelError('Failed to upload image', ErrorCode.UNKNOWN_ERROR);
        }
      }

      let fullResponse = '';
      let suggestedResponses: string[] = [];
      let messageComplete = false;
      let receivedSuggestions = false;

      // Only expect title updates for the first message in a thread
      const expectTitleUpdate = currentThread.messages.length <= 1;
      let receivedTitle = !expectTitleUpdate; // If we don't expect a title, mark as received
      const token = await getCopilotAuth();

      if (!token) {
        throw new AIModelError('No Copilot auth token found', ErrorCode.UNAUTHORIZED);
      }
      // Create WebSocket connection
      ws = new WebSocket(`wss://${new URL(this.baseUrl).hostname}/c/api/chat?api-version=2&accessToken=${token}`);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timeout');
          params.onEvent({
            type: 'ERROR',
            error: new AIModelError(
              'Connection timeout',
              ErrorCode.NETWORK_ERROR
            )
          });
          ws.close();
        }
      }, 7000); // 7 seconds timeout for connection

      // Function to safely close the WebSocket
      const safelyCloseWebSocket = () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }

        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          console.log('Safely closing WebSocket connection');
          try {
            ws.close();
          } catch (e) {
            console.error('Error closing WebSocket:', e);
          }
        }
        ws = null;
      };

      // Function to check if we can close the connection
      const checkAndCloseConnection = () => {
        if (messageComplete) {
          if ((receivedTitle && receivedSuggestions) || !closeTimeout) {
            safelyCloseWebSocket();
          }
        }
      };

      ws.onopen = () => {
        console.log('WebSocket connection opened');
        clearTimeout(connectionTimeout);

        // try {
        //   const data = JSON.stringify({ event: "setOptions", supportedCards: ["weather", "local", "image", "sports", "video", "ads", "finance"], ads: { supportedTypes: ["multimedia", "product", "tourActivity", "propertyPromotion", "text"] } })
        //   console.log('Sending chat config:', JSON.stringify(data));
        //   ws.send(data);
        // } catch (error) {
        //   console.error('Error setting config: ', error);
        //   params.onEvent({
        //     type: 'ERROR',
        //     error: new AIModelError(
        //       'Failed to send message (error setting config)',
        //       ErrorCode.NETWORK_ERROR
        //     )
        //   });
        //   safelyCloseWebSocket();
        // }

        // Send the chat message once the connection is established
        try {
          // Prepare content array based on whether we have an image
          const content = [];

          // Add image to content if available
          if (imageUrl) {
            content.push({
              type: "image",
              url: imageUrl
            });
          }

          // Add text prompt
          content.push({
            type: "text",
            text: params.prompt
          });

          const chatMessage = {
            event: "send",
            mode: validatedMode, // Use the validated mode
            conversationId: metadata.conversationId,
            content: content
          };

          console.log('Sending message:', JSON.stringify(chatMessage));
          ws.send(JSON.stringify(chatMessage));
        } catch (error) {
          console.error('Error sending message:', error);
          params.onEvent({
            type: 'ERROR',
            error: new AIModelError(
              'Failed to send message',
              ErrorCode.NETWORK_ERROR
            )
          });
          safelyCloseWebSocket();
        }
      };

      ws.onmessage = (event: WebSocket.MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          console.log('WebSocket message:', response);

          if (response.event === "received") {
            // Message received by the server
            console.log('Message received by server:', response.messageId);
          } else if (response.event === "startMessage") {
            // Start of the assistant's response
            console.log('Assistant starting response:', response.messageId);
          } else if (response.event === "appendText") {
            // Append text to the current response
            fullResponse += response.text || '';

            // Update the UI with the current response
            params.onEvent({
              type: 'UPDATE_ANSWER',
              data: { text: fullResponse }
            });
          } else if (response.event === "done") {
            // End of the response
            // Update thread with assistant's response
            const assistantMessage = this.createMessage('assistant', fullResponse);
            currentThread.messages.push(assistantMessage);

            // Update thread
            currentThread.updatedAt = Date.now();

            // Save thread to storage
            this.saveThread();

            params.onEvent({
              type: 'DONE',
              data: { threadId: currentThread.id } // Include thread ID for UI updates
            });

            // Mark message as complete
            messageComplete = true;

            // Set a timeout to close the connection if we don't receive other events
            closeTimeout = setTimeout(() => {
              console.log('Closing connection after timeout - did not receive all expected events');
              safelyCloseWebSocket();
            }, 5000); // 5 seconds timeout
          } else if (response.event === "suggestedFollowups" && response.suggestions) {
            // Store suggested responses
            suggestedResponses = response.suggestions.map((s: any) => s);

            // If we have an assistant message, add the suggestions as metadata
            if (currentThread.messages.length > 0) {
              const lastMessage = currentThread.messages[currentThread.messages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.metadata = { suggestedResponses };
                this.saveThread();

                // Notify UI about suggested responses
                params.onEvent({
                  type: 'SUGGESTED_RESPONSES',
                  data: { suggestions: suggestedResponses }
                });
              }
            }

            receivedSuggestions = true;
            checkAndCloseConnection();
          } else if (expectTitleUpdate && response.event === "titleUpdate" && response.title) {
            // Only process title updates for the first message in a thread
            console.log('Received title update:', response.title);
            currentThread.title = response.title;
            this.saveThread();

            // Notify the UI about the title update
            params.onEvent({
              type: 'TITLE_UPDATE',
              data: {
                title: response.title,
                threadId: currentThread.id
              }
            });

            receivedTitle = true;
            checkAndCloseConnection();
          }
        } catch (error) {
          console.error('Error parsing Copilot response:', error);
        }
      };

      ws.onerror = (error: WebSocket.ErrorEvent) => {
        console.error('WebSocket error:', error);
        params.onEvent({
          type: 'ERROR',
          error: new AIModelError(
            'WebSocket connection error',
            ErrorCode.NETWORK_ERROR
          )
        });
        safelyCloseWebSocket();
      };

      ws.onclose = (event: WebSocket.CloseEvent) => {
        console.log(`WebSocket connection closed with code ${event.code}`, event.reason);

        // Clear any pending timeouts
        clearTimeout(connectionTimeout);
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }

        // If the connection closed before we got a complete message, report an error
        if (!messageComplete) {
          params.onEvent({
            type: 'ERROR',
            error: new AIModelError(
              `Connection closed unexpectedly (${event.code})`,
              ErrorCode.NETWORK_ERROR
            )
          });
        }
      };

      // Handle abort signal
      if (params.signal) {
        params.signal.addEventListener('abort', () => {
          console.log('Request aborted by user');
          safelyCloseWebSocket();
        });
      }
    } catch (error) {
      // Clean up resources in case of error
      if (closeTimeout) {
        clearTimeout(closeTimeout);
      }

      if (ws) {
        try {
          ws.close();
        } catch (e) {
          console.error('Error closing WebSocket during error handling:', e);
        }
      }

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

  private async ensureThreadLoaded(): Promise<void> {
    if (!this.currentThread) {
      // Try to load the most recent thread for this model
      const threads = await this.getAllThreads();
      const bingThreads = threads.filter(t =>
        t.modelName === this.getName() && this.isValidBingMetadata(t.metadata)
      );

      if (bingThreads.length > 0) {
        // Sort by most recent and use that thread
        const mostRecentThread = bingThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        this.currentThread = mostRecentThread;
        console.log('Loaded existing thread from storage:', this.currentThread.id);
      } else {
        // Create a new thread if none exists
        await this.initNewThread();
      }
    }
  }

  private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
    if (!this.currentThread) {
      throw new AIModelError('No active thread', ErrorCode.INVALID_REQUEST);
    }
    return this.currentThread;
  }

  async initNewThread(): Promise<void> {
    const conversationInfo = await this.createConversation();

    this.currentThread = {
      id: uuid(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelName: this.getName(),
      metadata: conversationInfo
    };

    await this.saveThread();
  }

  async loadThread(threadId: string): Promise<void> {
    const threads = await this.getAllThreads();
    const thread = threads.find(t => t.id === threadId);

    if (thread && thread.modelName === this.getName()) {
      // Use the existing conversation ID instead of creating a new one
      this.currentThread = thread;
      await this.saveThread();
    } else {
      throw new Error('Thread not found');
    }
  }

  private async getBingMetadata(): Promise<BingThreadMetadata> {
    const currentThread = this.getCurrentThreadSafe();

    if (!currentThread.metadata) {
      throw new AIModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
    }

    const metadata = currentThread.metadata as BingThreadMetadata;
    if (!this.isValidBingMetadata(metadata)) {
      // If metadata is invalid, create a new conversation
      return await this.createConversation();
    }

    return metadata;
  }

  async saveThread(): Promise<void> {
    if (!this.currentThread) {
      throw new AIModelError('No active thread', ErrorCode.INVALID_REQUEST);
    }

    await super.saveThread();
  }


  private async uploadImage(image: File): Promise<string> {
    try {
      if (!(await requestHostPermission(`${this.baseUrl}/`))) {
        throw new AIModelError(`Missing ${this.baseUrl} permission`, ErrorCode.MISSING_HOST_PERMISSION);
      }

      // Get auth data
      const token = await getCopilotAuth();

      // Convert image to bytes
      const imageBuffer = await image.arrayBuffer();

      // Determine content type based on image format
      let contentType = 'image/jpeg';
      // Try to get content type from File object first
      if (image.type) {
        contentType = image.type;
      } else {
        // Fallback to determining content type from file extension
        const fileName = image.name.toLowerCase();
        if (fileName.endsWith('.png')) {
          contentType = 'image/png';
        } else if (fileName.endsWith('.gif')) {
          contentType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          contentType = 'image/webp';
        } else if (fileName.endsWith('.bmp')) {
          contentType = 'image/bmp';
        } else if (fileName.endsWith('.svg')) {
          contentType = 'image/svg+xml';
        }
      }

      // Create headers object
      const headers: Record<string, string> = {
        'content-type': contentType
      };

      // Add authorization if token exists
      if (token) {
        headers['authorization'] = `Bearer ${token}`;
      }

      // Upload the image 
      const response = await fetch(`${this.baseUrl}/c/api/attachments`, {
        method: 'POST',
        headers: headers,
        body: new Blob([imageBuffer], { type: contentType }),
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        console.error('Image upload failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new AIModelError(`Failed to upload image: ${response.status}`, ErrorCode.SERVICE_UNAVAILABLE);
      }

      const data = await response.json();
      console.log('Image upload response:', data);

      if (!data.url) {
        throw new AIModelError('Invalid image upload response', ErrorCode.SERVICE_UNAVAILABLE);
      }

      // Return the relative URL - we'll prepend the baseUrl when needed
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new AIModelError(
        'Failed to upload image to Copilot',
        ErrorCode.UNKNOWN_ERROR
      );
    }
  }
}