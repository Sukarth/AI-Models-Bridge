import { ofetch, FetchError } from 'ofetch';
import { v4 as uuid } from 'uuid';
import { AbstractModel } from './abstract-model';
import { ErrorCode, StatusEvent } from './types';


/**
 * Decorator for methods that interact directly with the Claude AI server, rather than process data from local storage.
 */
function serverOperation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	// Original method is preserved. This is just for documentation/marking purposes
	return descriptor;
}

interface ClaudeWebModelConfig {
	sessionKey?: string;
}

interface ClaudeThreadMetadata {
	organizationId: string;
	conversationId: string;
}

export class ClaudeWebModel extends AbstractModel {
	private sessionKey?: string;
	private organizationId?: string;

	constructor(config: ClaudeWebModelConfig = {}) {
		super();
		this.sessionKey = config.sessionKey;
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
			if (thread.modelName === this.getName() && !this.isValidClaudeMetadata(thread.metadata)) {
				await this.deleteThread(thread.id);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			await this.saveThreadsToStorage(threads.filter(t =>
				t.modelName !== this.getName() || this.isValidClaudeMetadata(t.metadata)
			));
		}
	}

	private isValidClaudeMetadata(metadata: any): metadata is ClaudeThreadMetadata {
		return metadata?.organizationId && metadata?.conversationId;
	}

	getName(): string {
		return 'Claude Web';
	}

	supportsImageInput(): boolean {
		return true;
	}

	// Fetch organization ID from Claude API


	// Create a new conversation in Claude
	private async createConversation(organizationId: string): Promise<string> {
		const conversationId = uuid();
		try {
			const response = await ofetch(`https://claude.ai/api/organizations/${organizationId}/chat_conversations`, {
				method: 'POST',
				headers: this.getHeaders(),
				credentials: 'include',
				body: { name: '', uuid: conversationId },
			});

			return conversationId;
		} catch (err) {
			if (err instanceof FetchError && err.status === 403) {
				throw this.handleModelError('There is no logged-in Claude account in this browser.', ErrorCode.UNAUTHORIZED, undefined, err); //TODO check throwing
				// throw new AIModelError(
				//   'There is no logged-in Claude account in this browser.', 
				//   ErrorCode.UNAUTHORIZED
				// );
			}
			throw this.handleModelError('Failed to create conversation', ErrorCode.SERVICE_UNAVAILABLE, undefined, err); //TODO check throwing
			//   throw new AIModelError(
			//     'Failed to create conversation', 
			//     ErrorCode.SERVICE_UNAVAILABLE
			//   );
		}
	}

	// Generate a title for the conversation
	private async generateChatTitle(organizationId: string, conversationId: string, content: string): Promise<string> {
		try {
			const resp = await ofetch(`https://claude.ai/api/organizations/${organizationId}/chat_conversations/${conversationId}/title`, {
				method: 'POST',
				headers: this.getHeaders(),
				credentials: 'include',
				body: {
					message_content: content,
					recent_titles: [],
				},
			});
			if (resp.title) {
				return resp.title
			}
			return 'New Conversation';
		} catch (error) {
			console.error('Failed to generate chat title:', error);
			// Non-critical error, we can continue without a title
			return 'New Conversation';
		}
	}

	// Get headers for Claude API requests
	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		};

		if (this.sessionKey) {
			headers.Cookie = `sessionKey=${this.sessionKey}`;
		}

		return headers;
	}

	// Ensure thread is loaded before sending messages
	private async ensureThreadLoaded(): Promise<void> {
		if (!this.currentThread) {
			// Try to load the most recent thread for this model
			const threads = await this.getAllThreads();
			const claudeThreads = threads.filter(t =>
				t.modelName === this.getName() && this.isValidClaudeMetadata(t.metadata)
			);

			if (claudeThreads.length > 0) {
				// Sort by most recent and use that thread
				const mostRecentThread = claudeThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
				this.currentThread = mostRecentThread;
				console.log('Loaded existing thread from storage:', this.currentThread.id);
			} else {
				// Create a new thread if none exists
				await this.initNewThread();
			}
		}
	}

	// Get Claude-specific metadata from the current thread
	private getClaudeMetadata(): ClaudeThreadMetadata {
		const currentThread = this.getCurrentThreadSafe();

		if (!currentThread.metadata) {
			throw this.handleModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
		}

		const metadata = currentThread.metadata as ClaudeThreadMetadata;
		if (!metadata.organizationId || !metadata.conversationId) {
			throw this.handleModelError('Invalid thread metadata', ErrorCode.INVALID_REQUEST);
		}

		return metadata;
	}

	// Get the current thread or throw an error if none exists
	private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
		if (!this.currentThread) {
			throw this.handleModelError('No active thread', ErrorCode.INVALID_REQUEST);
		}
		return this.currentThread;
	}

	// Initialize a new thread
	async initNewThread(): Promise<void> {
		try {
			const organizationId = await this.getOrganizationId();
			if (!organizationId) {
				throw this.handleModelError('Organization ID is required', ErrorCode.INVALID_REQUEST);
			}
			const conversationId = await this.createConversation(organizationId);

			this.currentThread = {
				id: conversationId,
				title: 'New Conversation',
				modelName: this.getName(),
				messages: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				metadata: {
					organizationId,
					conversationId
				}
			};

			await this.saveThread();
		} catch (error) {
			throw this.handleModelError('Error initializing new thread', ErrorCode.METADATA_INITIALIZATION_ERROR, undefined, error);//TODO check throwing
			//   console.error('Error initializing new thread:', error);
			//   throw error;
		}
	}

	// Load a specific thread
	async loadThread(threadId: string): Promise<void> {
		const threads = await this.getAllThreads();
		const thread = threads.find(t => t.id === threadId);

		if (thread && thread.modelName === this.getName()) {
			this.currentThread = thread;

			// Ensure we have the organization ID
			if (!this.organizationId && thread.metadata) {
				this.organizationId = (thread.metadata as ClaudeThreadMetadata).organizationId;
			}
		} else {
			throw this.handleModelError(`Thread ${threadId} not found`, ErrorCode.INVALID_THREAD_ID);
		}
	}

	// Send a message to Claude
	protected async doSendMessage(params: {
		prompt: string;
		image?: File;
		signal?: AbortSignal;
		style_key?: string;
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
			const metadata = this.getClaudeMetadata();

			// Add user message to thread
			const userMessage = this.createMessage('user', params.prompt);
			if (params.image) {
				userMessage.metadata = {
					imageDataUrl: await this.fileToDataUrl(params.image)
				};
			}
			currentThread.messages.push(userMessage);

			// Prepare attachments if there's an image
			let files: any = {};
			if (params.image) {
				const formData = new FormData();
				formData.append('file', params.image);
				// formData.append('orgUuid', metadata.organizationId);

				// Upload the image
				const uploadResp = await fetch(`https://claude.ai/api/${metadata.organizationId}/upload`, {
					method: 'POST',
					//   headers: {
					//     // Don't set Content-Type here, let the browser set it with the boundary
					//     Cookie: this.sessionKey ? `sessionKey=${this.sessionKey}` : '',
					//   },
					//   credentials: 'include',
					body: formData,
				});

				if (!uploadResp.ok) {
					throw this.handleModelError('Failed to upload image', ErrorCode.UPLOAD_FAILED, params, uploadResp);
				}
				files = await uploadResp.json();
			}
			let styles = await this.getStyles(metadata.organizationId);
			let style = this.findStyleByKey(styles, params.style_key || '')
			if (params.style_key && !style) {
				console.warn(`Style key '${params.style_key}' not found, using default style.`);
				// style = styles.defaultStyles[0];
			}

			// Send the message to Claude
			const response = await fetch(`https://claude.ai/api/organizations/${metadata.organizationId}/chat_conversations/${metadata.conversationId}/completion`, {
				method: 'POST',
				headers: this.getHeaders(),
				credentials: 'include',
				signal: params.signal,
				body: JSON.stringify({
					attachments: [],
					files: (!files || !files.file_uuid) ? [] : [files.file_uuid],
					locale: navigator.language || 'en-US',
					personalized_styles: style ? [style] : [],
					prompt: params.prompt,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				}),
			});

			if (!response.ok) {
				// Handle rate limit and other errors more gracefully
				const errorText = await response.text();
				// console.error(`Claude API error (${response.status}):`, errorText);

				try {

					// Try to parse the error response
					const errorData = JSON.parse(errorText);

					if (response.status === 429) {
						// Check if it's a rate limit error
						if (errorData.type === 'error' && errorData.error?.type === 'rate_limit_error') {
							try {
								// Parse the nested JSON message string
								errorData.error.message = JSON.parse(errorData.error.message);

								// Format the reset time to be human-readable
								let limitReset = '';
								if (errorData.error.resetsAt) {
									const resetDate = new Date(errorData.error.resetsAt * 1000);
									errorData.error.resetsAt.resetsAtReadable = resetDate.toLocaleString();
									limitReset = ` Rate limit resets at ${errorData.error.resetsAt.resetsAtReadable}`;
								}
								throw this.handleModelError(`Claude rate limit exceeded.${limitReset}`, ErrorCode.RATE_LIMIT_EXCEEDED, params, errorData);
								// throw new AIModelError(
								// 	`Claude rate limit exceeded. ${limitReset}`,
								// 	ErrorCode.RATE_LIMIT_EXCEEDED
								// );
							} catch (parseError) {
								// If we can't parse the nested JSON, just use the original message

								throw this.handleModelError(
									`Claude rate limit exceeded: ${errorData.error.message}`,
									ErrorCode.RATE_LIMIT_EXCEEDED,
									params,
									errorData
								);
							}
						}
					}

					// Handle other error types
					throw this.handleModelError(
						`Claude API error: ${JSON.stringify(errorData)}`,
						ErrorCode.SERVICE_UNAVAILABLE,
						params
					);
				} catch (parseError) {
					// If we can't parse the error as JSON, fall back to status code and text
					if (response.status === 429) {
						throw this.handleModelError(
							`Claude rate limit exceeded. Please try again later.`,
							ErrorCode.RATE_LIMIT_EXCEEDED,
							params
						);
					} else {
						throw this.handleModelError(
							`Claude API error: ${response.status} - ${errorText.substring(0, 200)}`,
							ErrorCode.SERVICE_UNAVAILABLE,
							params
						);
					}
				}
			}

			if (!response.body) {
				throw this.handleModelError('Response body is null', ErrorCode.SERVICE_UNAVAILABLE, params);
			}

			// Process the streaming response
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let fullText = '';
			let currentEventName = '';
			let currentEventData = '';

			// Process the stream
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				// Decode the chunk and add it to our buffer
				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;

				// Process each line in the buffer
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

				for (const line of lines) {
					if (!line.trim()) {
						// Empty line means the end of an event
						if (currentEventName && currentEventData) {
							// Process the event and update fullText if needed
							const updatedText = this.processEvent(currentEventName, currentEventData, fullText);
							if (updatedText !== null) {
								fullText = updatedText;
								// Send the accumulated text in the update event
								params.onEvent({
									type: 'UPDATE_ANSWER',
									data: { text: fullText }
								});
							}
							currentEventName = '';
							currentEventData = '';
						}
						continue;
					}

					// Parse the line based on SSE format
					if (line.startsWith('event:')) {
						currentEventName = line.substring(6).trim();
					} else if (line.startsWith('data:')) {
						currentEventData = line.substring(5).trim();
					}
				}
			}

			// Process any remaining data in the buffer
			if (buffer.trim()) {
				const lines = buffer.split('\n');
				for (const line of lines) {
					if (line.startsWith('event:')) {
						currentEventName = line.substring(6).trim();
					} else if (line.startsWith('data:')) {
						currentEventData = line.substring(5).trim();

						if (currentEventName && currentEventData) {
							const updatedText = this.processEvent(currentEventName, currentEventData, fullText);
							if (updatedText !== null) {
								fullText = updatedText;
								params.onEvent({
									type: 'UPDATE_ANSWER',
									data: { text: fullText }
								});
							}
						}
					}
				}
			}

			// Add assistant message to thread
			const assistantMessage = this.createMessage('assistant', fullText);
			currentThread.messages.push(assistantMessage);

			// Update thread metadata and save
			currentThread.updatedAt = Date.now();

			// Generate a title for the conversation if it's new
			if (currentThread.title === 'New Conversation' && currentThread.messages.length <= 2) {
				const title = await this.generateChatTitle(metadata.organizationId, metadata.conversationId, params.prompt);
				currentThread.title = title;
				params.onEvent({
					type: 'TITLE_UPDATE',
					data: {
						title: title,
						threadId: currentThread.id
					}
				});
			}

			// Save thread to storage
			await this.saveThread();

			// Send final DONE event
			params.onEvent({
				type: 'DONE',
				data: {
					threadId: currentThread.id
				}
			});
		} catch (error) {
			// When an error occurs, send it as an ERROR event
			this.handleModelError('Error sending message', ErrorCode.SERVICE_UNAVAILABLE, params, error);
			//   params.onEvent({
			//     type: 'ERROR',
			//     error: error instanceof AIModelError ? error : new AIModelError(
			//       error instanceof Error ? error.message : String(error),
			//       ErrorCode.NETWORK_ERROR
			//     )
			//   });
		}
	}

	// Helper method to process SSE events
	private processEvent(eventName: string, eventData: string, currentText: string, params?: { onEvent: (event: StatusEvent) => void }): string | null {
		if (!eventName || !eventData) return null;

		try {
			switch (eventName) {
				case 'completion':
					const data = JSON.parse(eventData);
					if (data.completion) {
						// Return the updated text (current text + new completion)
						return currentText + data.completion;
					}
					break;

				case 'error':
					const errorData = JSON.parse(eventData);
					//   console.error('Claude error event:', errorData);

					// Handle rate limit errors specifically
					if (errorData.type === 'rate_limit_error') {
						try {
							// Try to parse the nested message if it exists
							errorData.message = JSON.parse(errorData.message);

							let resetMessage = '';
							if (errorData.resetsAt) {
								const resetDate = new Date(errorData.resetsAt * 1000);
								errorData.resetsAt.resetsAtReadable = resetDate.toLocaleString();
								resetMessage = ` Rate limit resets at ${errorData.resetsAt.resetsAtReadable}`;
							}

							// Use handleModelError instead of throwing directly

							throw this.handleModelError(
								`Claude rate limit exceeded.${resetMessage}`,
								ErrorCode.RATE_LIMIT_EXCEEDED,
								params ? params : undefined,
								errorData
							);
						} catch (parseError) {
							// If we can't parse the nested JSON, just use the original message

							throw this.handleModelError(
								`Claude rate limit exceeded: ${errorData.message}`,
								ErrorCode.RATE_LIMIT_EXCEEDED,
								params ? params : undefined,
								errorData
							);
						}
					} else {

						throw this.handleModelError(
							errorData.error || errorData.message || 'Unknown Claude error',
							(errorData.error || errorData.message) ? ErrorCode.SERVICE_UNAVAILABLE : ErrorCode.UNKNOWN_ERROR,
							params ? params : undefined,
							errorData
						);
					}

				case 'ping':
					// Heartbeat event, no action needed
					return null;

				default:
					console.log(`Unhandled event type: ${eventName}`, eventData);
					return null;
			}
		} catch (e) {
			console.warn(`Error processing ${eventName} event:`, e);
			this.handleModelError(`Error processing ${eventName} event`, ErrorCode.UNKNOWN_ERROR, params, e);
		}

		return null;
	}

	// Convert a File to a data URL for storage
	private async fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}



	//=============================================================================
	// SERVER OPERATIONS - Methods below interact directly with Claude's servers, rather than the local storage.
	//=============================================================================

	/**
	 * Updates the title of a conversation on Claude's servers
	 * @param newTitle The new title to set for the conversation
	 * @param options Configuration options
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async editTitle(newTitle: string, options?: {
		loadThread?: boolean;
		metadata?: ClaudeThreadMetadata;
		tryUpdateThread?: boolean;
	}): Promise<void> {
		try {
			let shouldLoadThread = options?.loadThread !== false;
			let tryUpdateThread = options?.tryUpdateThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			// Get the metadata either from the thread or from the provided options
			let metadata: ClaudeThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();
				// Get the metadata from the current thread
				metadata = this.getClaudeMetadata();
			} else if (options?.metadata) {
				// Use the provided metadata
				metadata = options.metadata;

				// Validate the provided metadata
				if (!metadata.organizationId || !metadata.conversationId) {
					throw this.handleModelError(
						'Invalid metadata provided for sharing',
						ErrorCode.INVALID_REQUEST
					);
				}
			} else {
				// No thread loaded and no metadata provided
				throw this.handleModelError(
					'No thread loaded and no metadata provided for sharing',
					ErrorCode.INVALID_REQUEST
				);
			}
			const response = await fetch(
				`https://claude.ai/api/organizations/${metadata.organizationId}/chat_conversations/${metadata.conversationId}`,
				{
					method: 'PUT',
					headers: this.getHeaders(),
					credentials: 'include',
					body: JSON.stringify({
						name: newTitle
					})
				}
			);

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to update title: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			// Update the current thread title if it exists
			if (tryUpdateThread && this.currentThread) {
				this.currentThread.title = newTitle;
				await this.saveThread();
			}
		} catch (error) {
			throw this.handleModelError(
				'Error updating conversation title',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}



	/**
	 * Deletes one or more conversations from Claude's servers
	 * @param organizationId The organization ID
	 * @param conversationIds Array of conversation IDs to delete
	 * @returns Response data from the server
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async deleteServerThread(conversationIds: [], updateLocalThread: boolean = true, organizationId?: string | undefined): Promise<void> {
		try {
			if (!organizationId) {
				// organizationId = this.getClaudeMetadata().organizationId;	
				organizationId = await this.getOrganizationId()
			}

			if (!organizationId || !conversationIds) {
				throw this.handleModelError(
					'Invalid metadata provided for request',
					ErrorCode.INVALID_REQUEST
				);
			}

			const response = await fetch(
				`https://claude.ai/api/organizations/${organizationId}/chat_conversations/delete_many`,
				{
					method: 'POST',
					headers: this.getHeaders(),
					credentials: 'include',
					body: JSON.stringify({
						conversation_uuids: conversationIds
					})
				}
			);

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to get conversation: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			let data = await response.json();

			if (updateLocalThread) {
				for (let id of conversationIds) {
					await this.deleteThread(id);
				}
			}

			// if (data.failed) {
			// 	throw this.handleModelError(
			// 		`Failed to delete conversation(s) with Id(s): ${data.failed}`,
			// 		ErrorCode.SERVICE_UNAVAILABLE,
			// 		undefined,
			// 		data
			// 	);

			// }

			// if (data.deleted) {
			// 	console.log(`Conversation(s) with Id(s): ${data.deleted} deleted successfully`);
			// }

			return data;
		} catch (error) {
			throw this.handleModelError(
				'Error deleting conversation(s)',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}

	}

	/**
	 * Shares a conversation and gets a shareable URL from Claude's servers
	 * @param options Configuration options for sharing
	 * @returns A promise that resolves to a shareable URL
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async shareConversation(options?: {
		loadThread?: boolean;
		metadata?: ClaudeThreadMetadata;
	}): Promise<string> {
		try {
			let shouldLoadThread = options?.loadThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			// Get the metadata either from the thread or from the provided options
			let metadata: ClaudeThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();
				// Get the metadata from the current thread
				metadata = this.getClaudeMetadata();
			} else if (options?.metadata) {
				// Use the provided metadata
				metadata = options.metadata;

				// Validate the provided metadata
				if (!metadata.organizationId || !metadata.conversationId) {
					throw this.handleModelError(
						'Invalid metadata provided for sharing',
						ErrorCode.INVALID_REQUEST
					);
				}
			} else {
				// No thread loaded and no metadata provided
				throw this.handleModelError(
					'No thread loaded and no metadata provided for sharing',
					ErrorCode.INVALID_REQUEST
				);
			}

			// Send the share request to Claude
			const response = await fetch(
				`https://claude.ai/api/organizations/${metadata.organizationId}/chat_conversations/${metadata.conversationId}/share`,
				{
					method: 'POST',
					headers: this.getHeaders(),
					credentials: 'include',
					body: JSON.stringify({}), // Empty payload as specified
				}
			);

			if (!response.ok) {
				// Handle error cases
				const errorText = await response.text();
				throw this.handleModelError(
					`Failed to share conversation: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					errorText
				);
			}

			// Parse the response to get the share URL
			const shareData = await response.json();

			// The response should contain a uuid property
			if (!shareData.uuid) {
				throw this.handleModelError(
					'Share response did not contain a URL',
					ErrorCode.SERVICE_UNAVAILABLE
				);
			}
			const shareUrl = `https://claude.ai/share/${shareData.uuid}`;

			// Update the thread metadata with the share URL if we have a thread loaded
			if (shouldLoadThread && this.currentThread && this.currentThread.metadata) {
				this.currentThread.metadata.shareUrl = shareUrl;
				// Save the updated thread
				await this.saveThread();
			}

			// Return the shareable URL
			return shareUrl;
		} catch (error) {
			// Handle any errors that occurred during the sharing process
			throw this.handleModelError(
				'Error sharing conversation',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	 * Finds a style by its key in the styles data
	 * @param data The styles data object
	 * @param targetKey The key to search for
	 * @returns The found style or undefined
	 */
	findStyleByKey(data: any, targetKey: string): any | undefined {
		if (data && Array.isArray(data.defaultStyles)) {
			for (let i = 0; i < data.defaultStyles.length; i++) {
				if (data.defaultStyles[i] && data.defaultStyles[i].key === targetKey) {
					return data.defaultStyles[i];
				}
			}
		}

		// If we didn't find it in defaultStyles, let's check customStyles
		if (data && Array.isArray(data.customStyles)) {
			for (let i = 0; i < data.customStyles.length; i++) {
				if (data.customStyles[i] && data.customStyles[i].key === targetKey) {
					return data.customStyles[i];
				}
			}
		}

		// If we went through both arrays and didn't find it, return undefined
		return undefined;
	}

	/**
	 * Gets available styles from Claude's servers
	 * @param organizationId The organization ID
	 * @returns The styles data
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async getStyles(organizationId?: string): Promise<any> {
		if (!organizationId) {
			organizationId = await this.getOrganizationId();
		}
		const response = await fetch(
			`https://claude.ai/api/organizations/${organizationId}/list_styles`,
			{
				method: 'GET',
				headers: this.getHeaders(),
				credentials: 'include',
			}
		);

		if (!response.ok) {
			throw this.handleModelError(
				`Failed to get styles: ${response.status}`,
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				await response.text()
			);
		}

		return await response.json();

	}

	/**
	 * Gets conversation data from Claude's servers
	 * @param options Configuration options
	 * @returns The conversation data
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async getConversationData(options?: {
		loadThread?: boolean;
		metadata?: ClaudeThreadMetadata;
	}): Promise<any> {
		try {
			let shouldLoadThread = options?.loadThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			// Get the metadata either from the thread or from the provided options
			let metadata: ClaudeThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();
				// Get the metadata from the current thread
				metadata = this.getClaudeMetadata();
			} else if (options?.metadata) {
				// Use the provided metadata
				metadata = options.metadata;

				// Validate the provided metadata
				if (!metadata.organizationId || !metadata.conversationId) {
					throw this.handleModelError(
						'Invalid metadata provided for getting conversation',
						ErrorCode.INVALID_REQUEST
					);
				}
			} else {
				// No thread loaded and no metadata provided
				throw this.handleModelError(
					'No thread loaded and no metadata provided for getting conversation',
					ErrorCode.INVALID_REQUEST
				);
			}

			const response = await fetch(
				`https://claude.ai/api/organizations/${metadata.organizationId}/chat_conversations/${metadata.conversationId}`,
				{
					method: 'GET',
					headers: this.getHeaders(),
					credentials: 'include'
				}
			);

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to get conversation: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			return await response.json();

		} catch (error) {
			throw this.handleModelError(
				'Error getting conversation',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	 * Gets all conversations data from Claude's servers
	 * @param organizationId The organization ID
	 * @returns All conversations data
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async getAllConversationsData(organizationId?: string): Promise<any> {
		if (!organizationId) {
			organizationId = await this.getOrganizationId();
		}
		try {

			const response = await fetch(
				`https://claude.ai/api/organizations/${organizationId}/chat_conversations`,
				{
					method: 'GET',
					headers: this.getHeaders(),
					credentials: 'include',
					redirect: 'error',
					cache: 'no-cache'
				}
			);

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to get conversations data: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			return await response.json();

		} catch (error) {
			throw this.handleModelError(
				'Error getting conversations',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	 * Gets organization data from Claude's servers
	 * @param organizationId The organization ID
	 * @returns The organization data
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation	
	async getOrganizationData(organizationId?: string): Promise<any> {
		if (!organizationId) {
			organizationId = await this.getOrganizationId();
		}
		try {

			const response = await fetch(
				`https://claude.ai/api/organizations/${organizationId}`,
				{
					method: 'GET',
					headers: this.getHeaders(),
					credentials: 'include'
				}
			);

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to get organization data: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			return await response.json();

		} catch (error) {
			throw this.handleModelError(
				'Error getting organization',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	 * Gets all organizations data from Claude's servers
	 * @returns All organizations data
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async getAllOrganizationsData(): Promise<any> {
		try {

			const response = await fetch(
				`https://claude.ai/api/organizations`,
				{
					method: 'GET',
					headers: this.getHeaders(),
					credentials: 'include',
					redirect: 'error',
					cache: 'no-cache'
				}
			);

			if (response.status === 403) {
				throw this.handleModelError(
					'There is no logged-in Claude account in this browser.',
					ErrorCode.UNAUTHORIZED
				);
			}

			if (!response.ok) {
				throw this.handleModelError(
					`Failed to get organization data: ${response.status}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					undefined,
					await response.text()
				);
			}

			return await response.json();

		} catch (error) {
			throw this.handleModelError(
				'Error getting organization',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	 * Fetches the organization ID from Claude's servers
	 * @returns The organization ID or undefined
	 * @serverOperation This method makes direct API calls to Claude's servers
	 */
	@serverOperation
	async getOrganizationId(): Promise<string | undefined> {
		if (this.organizationId) {
			return this.organizationId;
		}

		try {
			const orgData = await this.getAllOrganizationsData()
			if (!orgData || !orgData.length) {
				throw this.handleModelError(
					'No organizations found for Claude account',
					ErrorCode.UNAUTHORIZED
				);
			}

			this.organizationId = orgData[0].uuid;
			return this.organizationId;
		} catch (err) {
			this.handleModelError('Claude webapp not available in your country or region', ErrorCode.SERVICE_UNAVAILABLE, undefined, err);
		}
	}
}