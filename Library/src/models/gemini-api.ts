import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode } from './types';

// We'll need to add the Google Generative AI SDK to package.json
// npm install @google/generative-ai

interface ConversationContext {
  chatSession: any; // Will be ChatSession from the SDK
}

export interface GeminiApiModelConfig {
  apiKey: string;
}

export class GeminiApiModel extends AbstractModel {
  private conversationContext?: ConversationContext;
  private sdk: any; // Will be GoogleGenerativeAI from the SDK

  constructor(config: GeminiApiModelConfig) {
    super();
    // We'll initialize the SDK in doSendMessage to avoid importing it here
    this.sdk = null;
    this.initializeSDK(config.apiKey);
  }

  private async initializeSDK(apiKey: string) {
    try {
      // Dynamically import the SDK to avoid bundling issues
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.sdk = new GoogleGenerativeAI(apiKey);
    } catch (error) {
      console.error('Failed to initialize Gemini SDK:', error);
    }
  }

  getName(): string {
    return 'Gemini Pro';
  }

  supportsImageInput(): boolean {
    return false; // Gemini Pro doesn't support image input in this implementation
  }

  resetConversation(): void {
    this.conversationContext = undefined;
  }

  async initNewThread(): Promise<void> {
    // Temporary implementation
    this.resetConversation();
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: { type: string; data?: any }) => void;
  }): Promise<void> {
    try {
      if (!this.sdk) {
        throw new AIModelError('Gemini API not initialized', ErrorCode.SERVICE_UNAVAILABLE);
      }

      if (!this.conversationContext) {
        const model = this.sdk.getGenerativeModel({ model: 'gemini-pro' });
        const chatSession = model.startChat();
        this.conversationContext = { chatSession };
      }

      const result = await this.conversationContext.chatSession.sendMessageStream(params.prompt);

      let text = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text += chunkText;
        params.onEvent({ type: 'UPDATE_ANSWER', data: { text } });
      }

      if (!text) {
        params.onEvent({ type: 'UPDATE_ANSWER', data: { text: 'Empty response' } });
      }
      
      params.onEvent({ type: 'DONE' });
    } catch (error) {
      if (error instanceof AIModelError) {
        throw error;
      }
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        return; // Request was aborted, no need to throw
      }
      
      throw new AIModelError(
        error instanceof Error ? error.message : String(error),
        ErrorCode.NETWORK_ERROR
      );
    }
  }
}