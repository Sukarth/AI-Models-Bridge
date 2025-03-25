import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode } from './types';
import { parseSSEResponse } from '../utils/sse';

interface ChatMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

interface ConversationContext {
  messages: ChatMessage[];
}

const CONTEXT_SIZE = 9;

export interface OpenRouterModelConfig {
  apiKey: string;
  model: string;
}

export class OpenRouterModel extends AbstractModel {
  private conversationContext?: ConversationContext;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: OpenRouterModelConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  getName(): string {
    return `OpenRouter/${this.model}`;
  }

  supportsImageInput(): boolean {
    return false;
  }

  resetConversation(): void {
    this.conversationContext = undefined;
  }

  private buildMessages(prompt: string): ChatMessage[] {
    return [
      ...this.conversationContext!.messages.slice(-(CONTEXT_SIZE + 1)), 
      { role: 'user', content: prompt }
    ];
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: { type: string; data?: any }) => void;
  }): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new AIModelError('OpenRouter API key is required', ErrorCode.MISSING_API_KEY);
      }

      if (!this.conversationContext) {
        this.conversationContext = { messages: [] };
      }

      const messages = this.buildMessages(params.prompt);

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'URL', //TODO
          'X-Title': 'TITLE', //TODO
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
      });

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({}));
        throw new AIModelError(
          error.error?.message || `HTTP error ${resp.status}`,
          resp.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.SERVICE_UNAVAILABLE
        );
      }

      // Add user message to context only after fetch success
      this.conversationContext.messages.push({
        role: 'user',
        content: params.prompt,
      });

      let done = false;
      const result: ChatMessage = { role: 'assistant', content: '' };

      const finish = () => {
        done = true;
        params.onEvent({ type: 'DONE' });
        const messages = this.conversationContext!.messages;
        messages.push(result);
      };

      await parseSSEResponse(resp, (message) => {
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
            result.content += delta.content;
            params.onEvent({
              type: 'UPDATE_ANSWER',
              data: { text: result.content },
            });
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