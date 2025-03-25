import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode } from './types';
import { streamAsyncIterable } from '../utils/stream-async-iterable';
import { v4 as uuid } from 'uuid';

interface Message {
  id: string;
  createdAt: number;
  data: string;
  from: 0 | 1; // human | bot
}

interface ConversationContext {
  conversationId: string;
  historyMessages: Message[];
  userId: number;
  lastMessageId?: string;
}

export class BaichuanWebModel extends AbstractModel {
  private conversationContext?: ConversationContext;

  getName(): string {
    return '百川大模型';
  }

  supportsImageInput(): boolean {
    return false;
  }

  resetConversation(): void {
    this.conversationContext = undefined;
  }

  private generateSessionId(): string {
    return uuid().replace(/-/g, '');
  }

  private generateMessageId(): string {
    return uuid().replace(/-/g, '');
  }

  private async getUserInfo(): Promise<{ id: number }> {
    try {
      const response = await fetch('https://www.baichuan-ai.com/api/user/info', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new AIModelError('Failed to get user info', ErrorCode.UNAUTHORIZED);
      }

      const data = await response.json();
      return { id: data.data.id || Math.floor(Math.random() * 1000000) };
    } catch (error) {
      // If we can't get the user info, generate a random ID
      return { id: Math.floor(Math.random() * 1000000) };
    }
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: { type: string; data?: any }) => void;
  }): Promise<void> {
    try {
      if (!this.conversationContext) {
        const conversationId = this.generateSessionId();
        const userInfo = await this.getUserInfo();
        this.conversationContext = { conversationId, historyMessages: [], userId: userInfo.id };
      }

      const { conversationId, lastMessageId, historyMessages, userId } = this.conversationContext;

      const message: Message = {
        id: this.generateMessageId(),
        createdAt: Date.now(),
        data: params.prompt,
        from: 0,
      };

      const resp = await fetch('https://www.baichuan-ai.com/api/chat/v1/chat', {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistant: {},
          assistant_info: {},
          retry: 3,
          type: "input",
          stream: true,
          request_id: uuid(),
          app_info: { id: 10001, name: 'baichuan_web' },
          user_info: { id: userId, status: 1 },
          prompt: {
            id: message.id,
            data: message.data,
            from: message.from,
            parent_id: lastMessageId || 0,
            created_at: message.createdAt,
            attachments: []
          },
          session_info: { id: conversationId, name: '新的对话', created_at: Date.now() },
          parameters: {
            repetition_penalty: -1,
            temperature: -1,
            top_k: -1,
            top_p: -1,
            max_new_tokens: -1,
            do_sample: -1,
            regenerate: 0,
            wse: true
          },
          history: historyMessages,
        }),
      });

      if (!resp.ok) {
        throw new AIModelError(`HTTP error ${resp.status}`, ErrorCode.SERVICE_UNAVAILABLE);
      }

      const decoder = new TextDecoder();
      let result = '';
      let answerMessageId: string | undefined;

      for await (const uint8Array of streamAsyncIterable(resp.body!)) {
        const str = decoder.decode(uint8Array);
        const lines = str.split('\n');
        for (const line of lines) {
          if (!line) {
            continue;
          }
          try {
            const data = JSON.parse(line);
            if (!data.answer) {
              continue;
            }
            answerMessageId = data.answer.id;
            const text = data.answer.data;
            if (text) {
              result += text;
              params.onEvent({ type: 'UPDATE_ANSWER', data: { text: result } });
            }
          } catch (error) {
            console.error('Error parsing Baichuan stream:', error);
          }
        }
      }

      this.conversationContext.historyMessages.push(message);
      if (answerMessageId) {
        this.conversationContext.lastMessageId = answerMessageId;
        if (result) {
          this.conversationContext.historyMessages.push({
            id: answerMessageId,
            data: result,
            createdAt: Date.now(),
            from: 1,
          });
        }
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
  // Add this method to implement the abstract requirement
  async initNewThread(): Promise<void> {
    this.conversationContext = undefined;
  }
}