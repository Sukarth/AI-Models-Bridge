import { AbstractModel } from './abstract-model';
import { AIModelError, ErrorCode } from './types';
import { parseSSEResponse } from '../utils/sse';

interface ConversationContext {
  conversationId: string;
}

export interface ClaudeWebModelConfig {
  sessionKey: string;
}

export class ClaudeWebModel extends AbstractModel {
  private organizationId?: string;
  private conversationContext?: ConversationContext;
  private model: string;
  private readonly sessionKey: string;

  constructor(config: ClaudeWebModelConfig) {
    super();
    this.sessionKey = config.sessionKey;
    this.model = 'claude-2.1';
  }

  getName(): string {
    return 'Claude (webapp/claude-2)';
  }

  supportsImageInput(): boolean {
    return false;
  }

  resetConversation(): void {
    this.conversationContext = undefined;
  }

  private async fetchOrganizationId(): Promise<string> {
    try {
      const response = await fetch('https://claude.ai/api/organizations', {
        headers: {
          Cookie: `sessionKey=${this.sessionKey}`,
        },
      });

      if (!response.ok) {
        throw new AIModelError('Failed to fetch organization ID', ErrorCode.UNAUTHORIZED);
      }

      const data = await response.json();
      if (!data || !data.length) {
        throw new AIModelError('No organizations found', ErrorCode.UNAUTHORIZED);
      }

      return data[0].uuid;
    } catch (error) {
      if (error instanceof AIModelError) {
        throw error;
      }
      throw new AIModelError('Failed to fetch organization ID', ErrorCode.NETWORK_ERROR);
    }
  }

  private async createConversation(organizationId: string): Promise<string> {
    try {
      const response = await fetch('https://claude.ai/api/organizations/' + organizationId + '/chat_conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sessionKey=${this.sessionKey}`,
        },
        body: JSON.stringify({
          name: '',
          uuid: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        throw new AIModelError('Failed to create conversation', ErrorCode.SERVICE_UNAVAILABLE);
      }

      const data = await response.json();
      return data.uuid;
    } catch (error) {
      if (error instanceof AIModelError) {
        throw error;
      }
      throw new AIModelError('Failed to create conversation', ErrorCode.NETWORK_ERROR);
    }
  }

  private async generateChatTitle(organizationId: string, conversationId: string, prompt: string): Promise<void> {
    try {
      await fetch('https://claude.ai/api/generate_chat_title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sessionKey=${this.sessionKey}`,
        },
        body: JSON.stringify({
          organization_uuid: organizationId,
          conversation_uuid: conversationId,
          message_content: prompt,
          recent_titles: [],
        }),
      });
    } catch (error) {
      // Ignore errors when generating chat title
      console.error('Failed to generate chat title:', error);
    }
  }

  protected async doSendMessage(params: {
    prompt: string;
    image?: File;
    signal?: AbortSignal;
    onEvent: (event: { type: string; data?: any }) => void;
  }): Promise<void> {
    try {
      if (!this.organizationId) {
        this.organizationId = await this.fetchOrganizationId();
      }

      if (!this.conversationContext) {
        const conversationId = await this.createConversation(this.organizationId);
        this.conversationContext = { conversationId };
        this.generateChatTitle(this.organizationId, conversationId, params.prompt).catch(console.error);
      }

      const resp = await fetch('https://claude.ai/api/append_message', {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sessionKey=${this.sessionKey}`,
        },
        body: JSON.stringify({
          organization_uuid: this.organizationId,
          conversation_uuid: this.conversationContext.conversationId,
          text: params.prompt,
          completion: {
            prompt: params.prompt,
            model: this.model,
          },
          attachments: [],
        }),
      });

      // Different models are available for different accounts
      if (!resp.ok && resp.status === 403 && this.model === 'claude-2.1') {
        const text = await resp.text();
        if (text.includes('model_not_allowed')) {
          this.model = 'claude-2.0';
          return this.doSendMessage(params);
        }
      }

      if (!resp.ok) {
        throw new AIModelError(`HTTP error ${resp.status}`, ErrorCode.SERVICE_UNAVAILABLE);
      }

      let result = '';

      await parseSSEResponse(resp, (message) => {
        try {
          const payload = JSON.parse(message);
          if (payload.completion) {
            result += payload.completion;
            params.onEvent({
              type: 'UPDATE_ANSWER',
              data: { text: result.trimStart() },
            });
          } else if (payload.error) {
            throw new AIModelError(JSON.stringify(payload.error), ErrorCode.SERVICE_UNAVAILABLE);
          }
        } catch (error) {
          if (error instanceof AIModelError) {
            throw error;
          }
          console.error('Error parsing Claude SSE message:', error);
        }
      });

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

  async initNewThread(): Promise<void> {
      // Temporary implementation
      this.resetConversation();
    }
}