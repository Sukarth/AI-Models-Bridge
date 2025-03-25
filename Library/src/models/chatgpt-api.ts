import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode } from './types';
import { parseSSEResponse } from '../utils/sse';
import { file2base64 } from '../utils/file';

interface ChatMessage {
  role: 'system' | 'assistant' | 'user';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
}

interface ConversationContext {
  messages: ChatMessage[];
}

const DEFAULT_SYSTEM_MESSAGE = 
  "You are ChatGPT, a large language model trained by OpenAI. " +
  "Answer as concisely as possible. " +
  "Current date: {current_date}";

const CONTEXT_SIZE = 9;

export interface ChatGPTApiConfig {
  apiKey: string;
  model?: string;
  systemMessage?: string;
}

export class ChatGPTApiModel extends AbstractModel {
  private conversationContext?: ConversationContext;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly systemMessage: string;

  constructor(config: ChatGPTApiConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-3.5-turbo';
    this.systemMessage = config.systemMessage || DEFAULT_SYSTEM_MESSAGE;
  }

  getName(): string {
    return `ChatGPT API (${this.model})`;
  }

  supportsImageInput(): boolean {
    return this.model.includes('gpt-4') && this.model.includes('vision');
  }

  resetConversation(): void {
    this.conversationContext = undefined;
  }

  private buildUserMessage(prompt: string, imageUrl?: string): ChatMessage {
    if (!imageUrl) {
      return { role: 'user', content: prompt };
    }
    return {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
      ],
    };
  }

  private buildMessages(prompt: string, imageUrl?: string): ChatMessage[] {
    const currentDate = new Date().toISOString().split('T')[0];
    const systemMessage = this.systemMessage.replace('{current_date}', currentDate);
    return [
      { role: 'system', content: systemMessage },
      ...this.conversationContext!.messages.slice(-(CONTEXT_SIZE + 1)),
      this.buildUserMessage(prompt, imageUrl),
    ];
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: { type: string; data?: any }) => void;
  }): Promise<void> {
    if (!this.apiKey) {
      throw new AIModelError('ChatGPT API key is required', ErrorCode.MISSING_API_KEY);
    }

    if (!this.conversationContext) {
      this.conversationContext = { messages: [] };
    }

    let imageUrl: string | undefined;
    if (params.image) {
      if (!this.supportsImageInput()) {
        throw new AIModelError(
          `The model ${this.model} does not support image input`,
          ErrorCode.UNKNOWN_ERROR
        );
      }
      imageUrl = await file2base64(params.image, true);
    }

    const messages = this.buildMessages(params.prompt, imageUrl);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
        signal: params.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new AIModelError(
          error.error?.message || `HTTP error ${response.status}`,
          response.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.SERVICE_UNAVAILABLE
        );
      }

      // Add user message to context only after fetch success
      this.conversationContext.messages.push(this.buildUserMessage(params.prompt, imageUrl));

      let done = false;
      const result: ChatMessage = { role: 'assistant', content: '' };

      const finish = () => {
        done = true;
        params.onEvent({ type: 'DONE' });
        const messages = this.conversationContext!.messages;
        messages.push(result);
      };

      await parseSSEResponse(response, (message) => {
        if (message === '[DONE]') {
          finish();
          return;
        }
        
        let data;
        try {
          data = JSON.parse(message);
        } catch (err) {
          console.error(err);
          return;
        }
        
        if (data?.choices?.length) {
          const delta = data.choices[0].delta;
          if (delta?.content) {
            if (typeof result.content === 'string') {
              result.content += delta.content;
              params.onEvent({
                type: 'UPDATE_ANSWER',
                data: { text: result.content },
              });
            }
          }
        }
      });

      if (!done) {
        finish();
      }
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

  async initNewThread(): Promise<void> {
      // Temporary implementation
      this.resetConversation();
    }
}