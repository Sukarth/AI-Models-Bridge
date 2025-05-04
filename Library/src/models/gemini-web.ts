import { ofetch } from 'ofetch';
import { v4 as uuid } from 'uuid';
import { AbstractModel } from './abstract-model';
import { AIModelError, ChatMessage, ChatThread, ErrorCode, StatusEvent } from './types'; // Added ChatMessage import


/**
 * Decorator for methods that interact directly with the Gemini server
 */
function serverOperation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	// Original method is preserved. This is just for documentation/marking purposes
	return descriptor;
}


interface GeminiThreadMetadata {
	conversationId: string; // Added top-level conversation ID
	contextIds: [string, string, string];
	requestParams: {
		atValue: string;
		blValue: string;
		sid: string;
	};
	emoji: string;
	defaultLang: string;
	defaultModel: string;
	shareUrl: string;
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

export class GeminiWebModel extends AbstractModel {
	constructor() {
		super();
		this.models = {
			"gemini-2.0-flash": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"f299729663a2343f"]' },
			"gemini-2.0-flash-exp": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"f299729663a2343f"]' },
			"gemini-2.0-flash-thinking": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"9c17b1863f581b8a"]' },
			"gemini-2.0-flash-thinking-with-apps": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"f8f8f5ea629f5d37"]' },
			"gemini-2.0-exp-advanced": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"b1e46a6037e6aa9f"]' },
			"gemini-1.5-flash": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"418ab5ea040b5c43"]' },
			"gemini-1.5-pro": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"9d60dfae93c9ff1f"]' },
			"gemini-1.5-pro-research": { "x-goog-ext-525001261-jspb": '[null,null,null,null,"e5a44cb1dae2b489"]' },
		};
		this.defaultModel = 'gemini-2.0-flash';
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
			if (thread.modelName === this.getName() && !this.isValidGeminiMetadata(thread.metadata)) {
				await this.deleteThread(thread.id);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			await this.saveThreadsToStorage(threads.filter(t =>
				t.modelName !== this.getName() || this.isValidGeminiMetadata(t.metadata)
			));
		}
	}

	private isValidGeminiMetadata(metadata: any): metadata is GeminiThreadMetadata {
		// Check for all required fields, including the new ones
		return metadata?.conversationId !== undefined &&
			metadata?.contextIds && Array.isArray(metadata.contextIds) && metadata.contextIds.length === 3 &&
			metadata?.requestParams?.atValue && metadata.requestParams?.blValue && metadata.requestParams?.sid &&
			typeof metadata?.emoji === 'string' && // emoji can be empty string
			typeof metadata?.defaultLang === 'string' && metadata.defaultLang && // Should not be empty
			typeof metadata?.defaultModel === 'string' && metadata.defaultModel &&
			typeof metadata?.shareUrl === 'string'; // Can be empty
	}

	// Get Claude-specific metadata from the current thread
	private getGeminiMetadata(): GeminiThreadMetadata {
		const currentThread = this.getCurrentThreadSafe();

		if (!currentThread.metadata) {
			return this.handleModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
		}

		const metadata = currentThread.metadata as GeminiThreadMetadata;
		if (!this.isValidGeminiMetadata(metadata)) {
			return this.handleModelError('Invalid thread metadata', ErrorCode.INVALID_REQUEST);
		}

		return metadata;
	}


	getName(): string {
		return 'Google Bard';
	}

	supportsImageInput(): boolean {
		return true;
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
				conversationId: '', // Initialize conversationId
				contextIds: ['', '', ''], // Will be populated on first message
				requestParams: await this.fetchRequestParams(),
				emoji: '', // Default emoji
				defaultLang: 'en', // Default language
				// defaultModel: this.defaultModel // Default model
				defaultModel: '2.0 Flash',
				shareUrl: ''
			}
		};

		// FIXED: Only save once using the proper method
		await this.saveThread();
		// REMOVED: The duplicate thread saving code
	}


	private async fetchRequestParams(): Promise<{ atValue: string; blValue: string; sid: string }> {
		try {
			const response = await ofetch('https://gemini.google.com/', {
				responseType: 'text'
			});
			const atValue = extractFromHTML('SNlM0e', response);
			const blValue = extractFromHTML('cfb2h', response);
			const sid = extractFromHTML('FdrFJe', response);
			if (!atValue || !blValue || !sid) {
				return this.handleModelError('Failed to extract Bard parameters', ErrorCode.UNAUTHORIZED);
			}
			return { atValue, blValue, sid };
		} catch (error) {
			return this.handleModelError(
				'Failed to initialize Bard session',
				ErrorCode.UNAUTHORIZED,
				undefined,
				error
			);
		}
	}

	// KEEP: Response parsing with image support (May need adaptation for fallback)
	private parseBardResponse(responseText: string): { text: string; ids: [string, string, string] } {
		try {
			// This function might need significant changes if the streaming structure
			// is the only reliable source of data. Keeping it for potential fallback/reference.
			const lines = responseText.split('\n');
			// Find the line containing the primary data payload
			const dataLine = lines.find(line => line.includes('"rc_')); // Heuristic to find the main data line
			if (!dataLine) {
				return this.handleModelError(
					'Could not find primary data line in response text for fallback parsing.',
					ErrorCode.RESPONSE_PARSING_ERROR
				);
			}

			// Attempt to parse the line containing the data
			let lineJson;
			try {
				lineJson = JSON.parse(dataLine);
			} catch (e) {
				return this.handleModelError(
					`Failed to parse data line JSON: ${e}`,
					ErrorCode.RESPONSE_PARSING_ERROR,
					undefined,
					e
				);
			}

			// Extract the inner JSON string (assuming structure [["wrb.fr", null, "JSON_STRING", ...]])
			if (!Array.isArray(lineJson) || !lineJson[0] || !lineJson[0][2]) {
				return this.handleModelError(
					'Unexpected structure in parsed data line.',
					ErrorCode.RESPONSE_PARSING_ERROR
				);
			}
			const payloadString = lineJson[0][2];
			const payload = JSON.parse(payloadString);


			if (!payload) {
				return this.handleModelError(
					'Empty response data',
					ErrorCode.RESPONSE_PARSING_ERROR
				);
			}

			// Extract data based on observed indices (these might be brittle)
			const text = payload[4]?.[0]?.[1]?.[0] ?? ''; // Main text
			const ids: [string, string, string] = [
				payload[1]?.[0] ?? '', // conversationId
				payload[1]?.[1] ?? '', // responseId
				payload[4]?.[0]?.[0] ?? '', // choiceId
			];

			// Image parsing logic (remains the same conceptually)
			const images = payload[4]?.[0]?.[4] || [];
			let processedText = text;
			for (const image of images) {
				const [media, source, placeholder] = image;
				if (media && source && placeholder && media[0]?.[0] && source[0]?.[0] && media[4]) {
					processedText = processedText.replace(placeholder, `[![${media[4]}](${media[0][0]})](${source[0][0]})`);
				}
			}

			return { text: processedText, ids };
		} catch (error) {
			// console.error('Error parsing Bard response (fallback):', error); // Removed redundant console.error
			return this.handleModelError(
				`Failed to parse Bard response (fallback): ${error}`,
				ErrorCode.RESPONSE_PARSING_ERROR, // Use specific parsing error
				undefined,
				error
			);
		}
	}


	// KEEP: Image upload functionality
	@serverOperation // Mark as server operation
	private async uploadImage(image: File): Promise<string> {
		try {
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
			// This is more of a service/network issue than parsing
			return this.handleModelError(
				'Failed to get upload URL for image',
				ErrorCode.SERVICE_UNAVAILABLE
			);
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
	} catch(error) {
		// Handle potential network or upload errors during the second fetch
		return this.handleModelError(
			`Failed to finalize image upload: ${image.name}`,
			ErrorCode.UPLOAD_FAILED,
			undefined, // No specific params context here
			error
		);
	}
}

	// UPDATE: Main message handling method to use thread system
	// Add this method to properly retrieve the thread from storage before each request
	private async ensureThreadLoaded(): Promise<void> {
		if (!this.currentThread) {
			// Try to load the most recent thread for this model
			const threads = await this.getAllThreads();
			const bardThreads = threads.filter(t =>
				t.modelName === this.getName() && this.isValidGeminiMetadata(t.metadata)
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
	// Update signature to accept images array
	protected async doSendMessage(params: {
		prompt: string;
		images?: File[]; // <-- FIX: Update signature
		signal?: AbortSignal;
		model?: string;
		onEvent: (event: StatusEvent) => void;
	}): Promise<void> {
		// --- Check Image Count ---
		if (params.images && params.images.length > 1) {
			// With the improved handleModelError, we don't need to return as it always throws
			this.handleModelError(
				'Gemini Web only supports one image per message.',
				ErrorCode.UPLOAD_AMOUNT_EXCEEDED,
				params
			);
			// The code below is unreachable since handleModelError always throws
		}
		// --- End Check ---

		let currentThread: ChatThread | undefined; // Define here to use in catch block

		try {
			params.onEvent({
				type: 'UPDATE_ANSWER',
				data: { text: '' }
			});

			// Make sure we have a valid thread with the latest data from storage
			await this.ensureThreadLoaded();

			// Now we can safely assert that currentThread exists
			currentThread = this.getCurrentThreadSafe(); // Assign to outer scope variable

			// Add user message
			const userMessage = this.createMessage('user', params.prompt);
			currentThread.messages.push(userMessage);

			// Get Bard-specific metadata
			const metadata = this.getBardMetadata();

			// IMPORTANT: Log the context IDs to verify they're being retrieved correctly
			console.log('Current context IDs before request:', metadata.contextIds);

			// Handle image upload (only use the first image if provided)
			let imageUrl: string | undefined;
			let imageFile: File | undefined;
			if (params.images && params.images.length > 0) {
				if (params.images.length > 1) {
					console.warn("GeminiWebModel only supports one image per message. Using the first image.");
				}
				imageFile = params.images[0];
				try {
					imageUrl = await this.uploadImage(imageFile);
					// Add image URL to user message metadata for potential display later
					userMessage.metadata = { ...(userMessage.metadata || {}), attachmentUrl: imageUrl };
				} catch (uploadError) {
					// Handle upload error specifically
					// With the improved handleModelError, we don't need to return as it always throws
					this.handleModelError(
						`Failed to upload image: ${imageFile.name}`,
						ErrorCode.UPLOAD_FAILED,
						params, // Pass params to allow sending ERROR event
						uploadError
					);
					// The code below is unreachable since handleModelError always throws
				}
			}

			const payload = [
				null,
				JSON.stringify([
					// Include image data if available
					[params.prompt, 0, null, imageUrl && imageFile ? [[[imageUrl, 1], imageFile.name]] : []],
					null,
					metadata.contextIds, // Use current context IDs
				]),
			];

			const modelHeaders = this.models[params.model || this.defaultModel];

			const resp = await fetch(
				'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
				{
					method: 'POST',
					signal: params.signal,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
						// Include model-specific headers
						...(modelHeaders || {}),
						// Add other necessary headers like cookies if needed
					},
					body: new URLSearchParams({
						at: metadata.requestParams.atValue,
						'f.req': JSON.stringify(payload),
						// Add query params directly to body for POST? Check network reqs.
						// Let's assume they should be query params for now.
						bl: metadata.requestParams.blValue,
						// sid: metadata.requestParams.sid,
						_reqid: String(generateReqId()),
						rt: 'c',
					}),
					// IMPORTANT: We need to process the stream, not parse the whole response at once
					// responseType: 'stream' // Not directly supported by fetch, handle body reader
				},
			);

			if (!resp.ok || !resp.body) {
				const errorText = await resp.text();
				return this.handleModelError(
					`Gemini API error: ${resp.status} - ${errorText.substring(0, 200)}`,
					ErrorCode.SERVICE_UNAVAILABLE,
					params
				);
			}

			// --- Stream Processing Logic ---
			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let fullText = '';
			let finalIds: [string, string, string] | null = null;
			let titleFound = false; // Flag to ensure title update only happens once

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process line by line
				let eolIndex;
				while ((eolIndex = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, eolIndex).trim();
					buffer = buffer.slice(eolIndex + 1);

					// Skip empty lines and chunk size indicators
					if (!line || /^\d+$/.test(line) || line === ")]}'") continue;

					try {
						const lineData = JSON.parse(line);

						// Check if it's the expected format [["wrb.fr", ...]]
						if (Array.isArray(lineData) && lineData.length > 0 && Array.isArray(lineData[0]) && lineData[0][0] === "wrb.fr") {
							const innerJsonString = lineData[0][2];
							if (typeof innerJsonString === 'string') {
								const innerData = JSON.parse(innerJsonString);

								// 1. Check for Title (only if not already found and it's the first message)
								if (!titleFound && currentThread.messages.length <= 1 && // Check if it's the first user message response
									innerData && innerData[10] && Array.isArray(innerData[10]) && typeof innerData[10][0] === 'string') {
									let title = innerData[10][0];
									if (title.endsWith('\n')) {
										title = title.slice(0, -1); // Remove trailing newline
									}
									if (title) {
										params.onEvent({
											type: 'TITLE_UPDATE',
											data: { title: title, threadId: currentThread.id }
										});
										// Update local thread title immediately
										currentThread.title = title;
										titleFound = true; // Prevent multiple title updates
									}
								}

								// 2. Check for Main Text Content
								// Structure: innerData[4][0][1][0]
								if (innerData && innerData[4]?.[0]?.[1]?.[0]) {
									const textChunk = innerData[4][0][1][0];
									// NOTE: Gemini often sends the *full* text in each chunk, not just the delta.
									// We should replace, not append, if this is the case.
									if (textChunk !== fullText) {
										fullText = textChunk; // Replace fullText with the latest version
										params.onEvent({
											type: 'UPDATE_ANSWER',
											data: { text: fullText }
										});
									}
								}

								// 3. Check for Final IDs
								// Structure: innerData[1][0] (convId), innerData[1][1] (respId), innerData[4][0][0] (choiceId)
								if (innerData && innerData[1]?.[0] && innerData[1]?.[1] && innerData[4]?.[0]?.[0]) {
									finalIds = [innerData[1][0], innerData[1][1], innerData[4][0][0]];
									// Update metadata immediately if IDs change (might happen mid-stream)
									if (currentThread.metadata) {
										const geminiMetadata = currentThread.metadata as GeminiThreadMetadata;
										// Update contextIds if they changed
										if (JSON.stringify(geminiMetadata.contextIds) !== JSON.stringify(finalIds)) {
											geminiMetadata.contextIds = finalIds;
											console.log('Updated context IDs mid-stream:', finalIds);
										}
										// Update conversationId if it changed or was initially empty
										if (finalIds[0] && geminiMetadata.conversationId !== finalIds[0]) {
											geminiMetadata.conversationId = finalIds[0];
											console.log('Updated conversationId mid-stream:', finalIds[0]);
										}
									}
								}

								// TODO: Check for image data innerData[4][0][4] and parse if needed
							}
						}
					} catch (e) {
						console.warn('Error parsing Gemini stream line:', line, e);
					}
				}
			}
			// --- End Stream Processing ---

			if (!finalIds) {
				// Fallback: Try parsing the last known full text if IDs weren't found in stream
				// This might happen if the final chunk structure is different.
				console.warn("Final IDs not found in stream, attempting fallback parse.");
				try {
					// This assumes the old parseBardResponse logic might work on the final accumulated text
					// This is less reliable than stream parsing.
					const parsedFallback = this.parseBardResponse(fullText); // Need to adapt parseBardResponse if structure changed
					finalIds = parsedFallback.ids;
				} catch (fallbackError) {
					console.error("Fallback parsing failed:", fallbackError);
					return this.handleModelError('Failed to extract final IDs from response stream', ErrorCode.RESPONSE_PARSING_ERROR, params, fallbackError);
				}
			}

			// Update thread with assistant's response
			const assistantMessage = this.createMessage('assistant', fullText); // Use the final accumulated text
			assistantMessage.metadata = { messageId: finalIds[1] }; // Use responseId as messageId
			currentThread.messages.push(assistantMessage);

			// Update thread metadata with final context IDs
			if (currentThread.metadata) {
				const geminiMetadata = currentThread.metadata as GeminiThreadMetadata;
				geminiMetadata.contextIds = finalIds;
				// Ensure conversationId is also set from the final IDs
				geminiMetadata.conversationId = finalIds[0] || ''; // Use first contextId or empty string
			}
			currentThread.updatedAt = Date.now();

			// Save thread to storage
			await this.saveThread();


			// Send final DONE event
			params.onEvent({
				type: 'DONE',
				data: {
					threadId: currentThread.id // Use the main thread ID
					// Optionally include final metadata or message ID if needed by UI
					// messageId: finalIds[1]
				}
			});
		} catch (error) {
			// Ensure the error is handled and propagated
			this.handleModelError(
				'Error during Gemini message sending or processing',
				error instanceof AIModelError ? error.code : ErrorCode.NETWORK_ERROR,
				params,
				error
			);
			// Note: handleModelError now throws the error, so no need to re-throw here.
		}
	}

	// OVERRIDE: Thread loading to handle Bard session refresh
	async loadThread(threadId: string): Promise<void> {
		const threads = await this.getAllThreads();
		const thread = threads.find(t => t.id === threadId);

		if (thread && thread.modelName === this.getName()) {
			this.currentThread = thread;
			// Refresh Bard session
			const metadata = this.currentThread.metadata as GeminiThreadMetadata;
			metadata.requestParams = await this.fetchRequestParams();
			await this.saveThread();
			await this.saveThreadsToStorage(threads);
		}
	}

	private getBardMetadata(): GeminiThreadMetadata {
		const currentThread = this.getCurrentThreadSafe();

		if (!currentThread.metadata) {
			return this.handleModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
		}

		if (!this.isValidGeminiMetadata(currentThread.metadata)) {
			return this.handleModelError('Invalid or incomplete thread metadata', ErrorCode.INVALID_REQUEST);
		}
		const metadata = currentThread.metadata as GeminiThreadMetadata;

		return metadata;
	}

	private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
		if (!this.currentThread) {
			return this.handleModelError('No active thread', ErrorCode.INVALID_REQUEST);
		}
		return this.currentThread;
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


	/**
	 * Updates the title and optionally the emoji of a conversation on Gemini's servers
	 * @param newTitle The new title to set for the conversation
	 * @param emoji Optional emoji character to set
	 * @param options Optional configuration options
	 * @serverOperation This method makes direct API calls to Gemini's servers
	 */
	@serverOperation
	async editTitle(newTitle: string, emoji?: string, options?: {
		loadThread?: boolean;
		metadata?: GeminiThreadMetadata;
		tryUpdateThread?: boolean;
	}): Promise<void> {
		try {
			let shouldLoadThread = options?.loadThread !== false;
			let tryUpdateThread = options?.tryUpdateThread !== false;
			let metadata: GeminiThreadMetadata;
			console.log(shouldLoadThread, tryUpdateThread)

			if (shouldLoadThread) {
				await this.ensureThreadLoaded();
				metadata = this.getBardMetadata();
			} else if (options?.metadata) {
				metadata = options.metadata;
				if (!this.isValidGeminiMetadata(metadata)) {
					return this.handleModelError(
						'Invalid metadata provided for title edit',
						ErrorCode.INVALID_REQUEST
					);
				}
			} else {
				return this.handleModelError(
					'No thread loaded and no metadata provided for title edit',
					ErrorCode.INVALID_REQUEST
				);
			}

			const conversationId = metadata.conversationId; // Use the standardized field
			if (!conversationId) {
				// Attempt fallback to contextIds[0] just in case, but log a warning
				const fallbackId = metadata.contextIds[0];
				if (fallbackId) {
					console.warn("Using fallback conversation ID from contextIds[0] for editTitle");
					metadata.conversationId = fallbackId; // Update metadata if found via fallback
					await this.saveThread(); // Save the corrected metadata
				} else {
					return this.handleModelError('Missing conversation ID in metadata for editTitle', ErrorCode.INVALID_REQUEST);
				}
			}

			// Construct the inner payload based on observed network requests
			// Structure for emoji: [conversationId, newTitle, null, null, emoji, null, null, null, null, [1, ""] ]
			// Structure without emoji: [conversationId, newTitle]
			const innerPayloadArray: any[] = [conversationId, newTitle];
			if (emoji) {
				innerPayloadArray.push(null, null, emoji, null, null, null, null, null, [1, emoji]);
			}

			const inner_json_string = JSON.stringify([
				null,
				// This part seems constant based on observations
				[["title", "icon", "user_selected_icon"]],
				innerPayloadArray,
			]);

			// Construct the main f.req payload
			// Structure: [[["MUAZcd", inner_json_string, null, "generic"]]]
			const f_req_payload = JSON.stringify([
				[
					"MUAZcd", // RPC ID for title update
					inner_json_string,
					null,
					"generic"
				]
			]);

			const requestUrl = new URL('https://gemini.google.com/_/BardChatUi/data/batchexecute');
			requestUrl.searchParams.set('rpcids', 'MUAZcd');
			requestUrl.searchParams.set('source-path', `/app/${conversationId}`); // Use conversation ID in path
			requestUrl.searchParams.set('bl', metadata.requestParams.blValue);
			// Use f.sid from metadata if available, otherwise generate one
			const fSid = metadata.requestParams.sid ?? String(-Math.floor(Math.random() * 9e18));
			requestUrl.searchParams.set('f.sid', fSid);
			requestUrl.searchParams.set('hl', 'en'); // Assuming English
			requestUrl.searchParams.set('_reqid', String(generateReqId()));
			requestUrl.searchParams.set('rt', 'c');

			let params = new URLSearchParams({
				at: metadata.requestParams.atValue,
				'f.req': '[' + f_req_payload + ']',
			})

			const response = await ofetch.raw(requestUrl.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
					// Add other necessary headers if identified
				},
				body: params.toString() + '&',
				// Use parseResponse to handle potential initial junk characters
				parseResponse: (txt) => {
					const cleanedText = txt.substring(txt.indexOf('\n') + 1); // Skip potential )]}' line
					const lines = cleanedText.split('\n');
					// Find the line containing the main data array (starts with [[ "wrb.fr" ... ]])
					const dataLine = lines.find(line => line.trim().startsWith('[["wrb.fr"'));
					if (!dataLine) {
						console.error("Raw editTitle response:", txt); // Log raw response on failure
						return this.handleModelError(
							"Could not find data line in editTitle response",
							ErrorCode.RESPONSE_PARSING_ERROR
						);
					}
					return JSON.parse(dataLine);
				}
			});

			// Check response structure for success indication
			// Example success: [["wrb.fr","MUAZcd","[null,["c_...", "New Title", ...]]", ...]]
			console.log('Raw editTitle response:', response); // Log raw response for confirmation
			console.log('Parsed e response:', response?._data[0][0]);
			console.log('Parersed e response:', response?._data[0][1]);
			if (response && typeof (response) === 'object' && response?._data[0][0] === 'wrb.fr' && response?._data[0][1] === 'MUAZcd' && response?._data[0][2]) {
				console.log('Title updated successfully on server.');
				// Optionally parse the inner JSON to confirm the new title/emoji
				try {
					const innerResponse = JSON.parse(response?._data[0][2]);
					const changedTitle = innerResponse[1][1]; // Assuming structure [null, [convId, title, ..., emoji?, ...]]
					const emoji = innerResponse[1][4];
					console.log('Server response after title update:', innerResponse); // Log the full response for confirmation
					console.log('Server title change confirmation received:', changedTitle);
					console.log(this.currentThread);
					if (tryUpdateThread && this.currentThread && this.currentThread.metadata) {
						console.log(this.currentThread);
						this.currentThread.title = changedTitle; // Update local title
						this.currentThread.metadata.emoji = emoji || ""; // Store emoji in thread metadata
						await this.saveThread(); // Save updated thread
						console.log('Thread updated locally after title change confirmation.');
					}
				} catch (parseError) {
					console.warn('Could not parse success response details:', parseError);
					console.error('Unexpected response structure after title update. Could not parse response:', response);
					return this.handleModelError('Title update succeeded but response format unexpected', ErrorCode.RESPONSE_PARSING_ERROR, undefined, parseError);
				}
			} else {
				// Keep UNKNOWN_ERROR here as the failure reason isn't parsing itself
				return this.handleModelError('Title update failed. Server response did not indicate success.', ErrorCode.UNKNOWN_ERROR);
			}

		} catch (error) {
			// Use handleModelError to throw a consistent error type
			this.handleModelError(
				'Error updating conversation title',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined, // No onEvent callback here
				error
			);
		}
	}

	/**
	   * Deletes one or more conversations from Gemini's servers.
	   * Note: This operation involves two separate API calls per conversation.
	   * @param threadIds Array of thread IDs (which correspond to conversation IDs in metadata) to delete.
	   * @param updateLocalThread If true, also delete the thread from local storage upon successful server deletion.
	   * @param createNewThreadAfterDelete If true and the currently active thread is deleted locally, initialize a new thread.
	   * @serverOperation This method makes direct API calls to Gemini's servers.
	   */
	@serverOperation
	async deleteServerThreads(threadIds: string[], updateLocalThread: boolean = true, createNewThreadAfterDelete: boolean = true): Promise<void> {
		// Outer try-catch for general errors (e.g., fetching threads)
		try {
			const allThreads = await this.getAllThreads();

			for (const threadId of threadIds) {
				// Inner try-catch for errors specific to deleting a single thread
				try {
					const thread = allThreads.find(t => t.metadata?.conversationId === threadId);

					if (!thread) {
						console.warn(`[deleteServerThreads] Thread ${threadId} not found locally.`);
						continue; // Skip to the next ID
					}

					if (thread.modelName !== this.getName()) {
						console.warn(`[deleteServerThreads] Thread ${threadId} has incorrect model name: ${thread.modelName}. Skipping.`);
						continue;
					}

					if (!this.isValidGeminiMetadata(thread.metadata)) {
						console.warn(`[deleteServerThreads] Thread ${threadId} has invalid or missing metadata. Cannot delete from server.`);
						if (updateLocalThread) {
							console.warn(`[deleteServerThreads] Deleting thread ${threadId} locally due to invalid metadata.`);
							await this.deleteThread(thread.id, createNewThreadAfterDelete);
						}
						continue;
					}

					const metadata = thread.metadata;
					let conversationId = metadata.conversationId; // Use standardized field
					let atValue = metadata.requestParams.atValue;
					let blValue = metadata.requestParams.blValue;

					// Validate and potentially fallback for conversationId
					if (!conversationId) {
						const fallbackId = metadata.contextIds[0];
						if (fallbackId) {
							console.warn(`[deleteServerThreads] Using fallback conversation ID from contextIds[0] for thread ${threadId}.`);
							metadata.conversationId = fallbackId; // Update metadata
							conversationId = fallbackId; // Update local variable
							await this.saveThread(); // Save updated metadata
						} else {
							console.warn(`[deleteServerThreads] Missing conversation ID in metadata for thread ${threadId}. Cannot delete from server.`);
							if (updateLocalThread) {
								console.warn(`[deleteServerThreads] Deleting thread ${threadId} locally due to missing conversation ID.`);
								await this.deleteThread(thread.id, createNewThreadAfterDelete);
							}
							continue; // Skip server deletion for this thread
						}
					}

					// Validate and potentially refresh requestParams
					if (!atValue || !blValue) {
						console.warn(`[deleteServerThreads] Missing 'at' or 'bl' value in requestParams for thread ${threadId}. Fetching fresh params.`);
						try {
							metadata.requestParams = await this.fetchRequestParams();
							atValue = metadata.requestParams.atValue; // Update local variables
							blValue = metadata.requestParams.blValue;
							await this.saveThread(); // Save updated metadata back
						} catch (fetchErr) {
							console.error(`[deleteServerThreads] Failed to refresh requestParams for thread ${threadId}. Skipping server delete.`, fetchErr);
							if (updateLocalThread) {
								console.warn(`[deleteServerThreads] Deleting thread ${threadId} locally due to failed param refresh.`);
								await this.deleteThread(thread.id, createNewThreadAfterDelete);
							}
							continue; // Skip server deletion for this thread
						}
					}

					// --- Proceed with Deletion Requests ---
					const baseApiUrl = 'https://gemini.google.com/_/BardChatUi/data/batchexecute';

					// Request 1: RPC ID GzXR5e
					const fReq1Payload = JSON.stringify([["GzXR5e", JSON.stringify([conversationId]), null, "generic"]]);
					const urlParams1 = new URLSearchParams({
						rpcids: 'GzXR5e', 'source-path': '/app', bl: blValue,
						'f.sid': metadata.requestParams.sid ?? String(-Math.floor(Math.random() * 9e18)),
						hl: 'en', _reqid: String(generateReqId()), rt: 'c',
					});
					const bodyParams1 = new URLSearchParams({ at: atValue, 'f.req': `[${fReq1Payload}]` });

					console.log(`[deleteServerThreads] Sending Request 1 for ${threadId} (ConvID: ${conversationId})`);
					const response1 = await ofetch.raw(`${baseApiUrl}?${urlParams1.toString()}`, {
						method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
						body: bodyParams1.toString() + '&', parseResponse: txt => txt
					});

					if (response1.status !== 200) {
						console.error(`[deleteServerThreads] Request 1 failed for ${threadId}. Status: ${response1.status}`, await response1._data);
						return this.handleModelError(
							`Request 1 failed with status ${response1.status}`,
							ErrorCode.SERVICE_UNAVAILABLE
						);
					}
					console.log(`[deleteServerThreads] Request 1 successful for ${threadId}.`);

					// Request 2: RPC ID qWymEb
					const fReq2Payload = JSON.stringify([["qWymEb", JSON.stringify([conversationId, [1, null, 0, 1]]), null, "generic"]]);
					const urlParams2 = new URLSearchParams({
						rpcids: 'qWymEb', 'source-path': '/app', bl: blValue,
						'f.sid': metadata.requestParams.sid ?? String(-Math.floor(Math.random() * 9e18)),
						hl: 'en', _reqid: String(generateReqId()), rt: 'c',
					});
					const bodyParams2 = new URLSearchParams({
						at: atValue,
						'f.req': `[${fReq2Payload}]`
					});

					console.log(`[deleteServerThreads] Sending Request 2 for ${threadId} (ConvID: ${conversationId})`);
					const response2 = await ofetch.raw(`${baseApiUrl}?${urlParams2.toString()}`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
						body: bodyParams2.toString() + '&',
						parseResponse: txt => txt
					});

					if (response2.status !== 200) {
						console.error(`[deleteServerThreads] Request 2 failed for ${threadId}. Status: ${response2.status}`, await response2._data);
						return this.handleModelError(
							`Request 2 failed with status ${response2.status}`,
							ErrorCode.SERVICE_UNAVAILABLE
						);
					}
					console.log(`[deleteServerThreads] Request 2 successful for ${threadId}.`);

					// Local Deletion (if requested)
					if (updateLocalThread) {
						console.log(`[deleteServerThreads] Deleting thread ${threadId} locally.`);
						await this.deleteThread(thread.id, createNewThreadAfterDelete);
					}

				} catch (threadError) {
					// Log the error for the specific thread but continue with the next one
					console.error(`[deleteServerThreads] Failed to process thread ${threadId}:`, threadError);
					// Optionally re-throw if you want the whole operation to fail on a single thread error
					// throw threadError;
				}
			} // End loop through threadIds

		} catch (error) {
			// Handle general errors (e.g., fetching all threads)
			return this.handleModelError(
				'Error during server thread deletion process',
				ErrorCode.SERVICE_UNAVAILABLE, // Or a more specific code if applicable
				undefined,
				error
			);
		}
	}


	/**
	 * Gets conversation data (messages) from Gemini's servers
	 * @param options Configuration options, requires metadata or loading the current thread
	 * @returns The parsed conversation messages in chronological order
	 * @serverOperation This method makes direct API calls to Gemini's servers
	 */
	@serverOperation
	async getConversationData(options?: {
		loadThread?: boolean;
		metadata?: GeminiThreadMetadata;
	}): Promise<ChatMessage[]> { // Return ChatMessage array
		try {
			let shouldLoadThread = options?.loadThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			// Get the metadata either from the thread or from the provided options
			let metadata: GeminiThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();
				// Get the metadata from the current thread
				metadata = this.getBardMetadata(); // Use getBardMetadata for consistency
			} else if (options?.metadata) {
				// Use the provided metadata
				metadata = options.metadata;

				// Validate the provided metadata
				if (!this.isValidGeminiMetadata(metadata)) {
					return this.handleModelError(
						'Invalid metadata provided for getting conversation data',
						ErrorCode.INVALID_REQUEST
					);
				}
			} else {
				// No thread loaded and no metadata provided
				return this.handleModelError(
					'No thread loaded and no metadata provided for getting conversation data',
					ErrorCode.INVALID_REQUEST
				);
			}

			// Use conversationId primarily, fallback to contextIds[0] if needed
			const conversationId = metadata.conversationId || metadata.contextIds[0];
			if (!conversationId) {
				return this.handleModelError('Missing conversation ID in metadata', ErrorCode.INVALID_REQUEST);
			}

			// Construct the inner JSON string based on observed network request
			// Structure: [conversationId, 10, null, 1, [1], null, 1]
			const inner_json_string = JSON.stringify([
				conversationId,
				10, // Observed parameter (likely max messages to fetch, but seems fixed)
				null, 1, [1], null, null, 1 // Other observed parameters
			]);

			// Construct the main f.req payload
			// Structure: [[["hNvQHb", inner_json_string, null, "generic"]]]
			const f_req_payload = JSON.stringify([
				["hNvQHb", inner_json_string, null, "generic"] // RPC ID for getting conversation data
			]);

			// Build URL with parameters
			const requestUrl = new URL('https://gemini.google.com/_/BardChatUi/data/batchexecute');
			requestUrl.searchParams.set('rpcids', 'hNvQHb');
			requestUrl.searchParams.set('source-path', `/app/${conversationId.substring(2)}`);
			requestUrl.searchParams.set('bl', metadata.requestParams.blValue);
			// Use f.sid from metadata if available, otherwise generate one
			const fSid = metadata.requestParams.sid ?? String(-Math.floor(Math.random() * 9e18));
			requestUrl.searchParams.set('f.sid', fSid);
			requestUrl.searchParams.set('hl', 'en'); // Assuming English
			requestUrl.searchParams.set('_reqid', String(generateReqId()));
			requestUrl.searchParams.set('rt', 'c');

			let searchParams = new URLSearchParams({
				'f.req': `[${f_req_payload}]`, // Wrap payload in brackets
				at: metadata.requestParams.atValue,
			})

			// Send the request
			const response = await ofetch(requestUrl.toString(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: searchParams + '&',
				// Use parseResponse to skip initial junk and parse the main JSON
				parseResponse: (txt) => {
					const cleanedText = txt.substring(txt.indexOf('\n') + 1); // Skip )]}' line
					const lines = cleanedText.split('\n');
					// Find the line containing the main data array
					const dataLine = lines.find(line => line.trim().startsWith('[["wrb.fr"'));
					if (!dataLine) {
						console.error("Raw getConversationData response:", txt);
						return this.handleModelError(
							"Could not find data line in getConversationData response",
							ErrorCode.RESPONSE_PARSING_ERROR
						);
					}
					return JSON.parse(dataLine);
				}
			});

			console.log(response)

			// --- Parse the Response ---
			// Expected structure: [["wrb.fr","hNvQHb","[[[message_pair_1],[message_pair_2]],null,null,[]]", ...]]
			if (!response || !Array.isArray(response) || response.length === 0 || !Array.isArray(response[0]) || response[0].length < 3) {
				console.error("Unexpected response structure in getConversationData:", response);
				// Use handleModelError and specific code
				return this.handleModelError("Unexpected response structure in getConversationData", ErrorCode.RESPONSE_PARSING_ERROR);
			}

			const conversationPayloadString = response[0][2];
			const conversationPayload = JSON.parse(conversationPayloadString);

			// Expected payload structure: [[[convId, userMsgId], [convId, respId, choiceId], [[userText], ...], [[assistantMsgData], ...]], [...next_pair...]]
			const extractedMessages: ChatMessage[] = [];
			if (Array.isArray(conversationPayload?.[0])) {
				// Reverse the message pairs to get most recent messages first
				for (const messagePair of conversationPayload[0].slice().reverse()) {
					// Validate the structure of the message pair
					if (!Array.isArray(messagePair) || messagePair.length < 4) {
						console.warn("Skipping invalid message pair structure:", messagePair);
						continue;
					}

					// User message (index 2) - Structure: [[userText], 1, null, 0, modelId, 0]
					const userMessageData = messagePair[2];
					const userTimestampData = messagePair[4];
					let userMsg = null;
					if (Array.isArray(userMessageData) && Array.isArray(userMessageData[0]) && typeof userMessageData[0][0] === 'string') {
						const userText = userMessageData[0][0];
						// Use only the first part of the timestamp array as the timestamp
						const timestamp = (Array.isArray(userTimestampData) && typeof userTimestampData[0] === 'number')
							? userTimestampData[0]
							: undefined;
						userMsg = this.createMessage('user', userText);
						if (timestamp !== undefined) {
							userMsg.timestamp = timestamp;
						}
						userMsg.metadata = {};
					} else {
						console.warn("Could not extract user message text from:", userMessageData);
					}

					// Assistant message (index 3) - Structure: [[[msgId, [content], ...]], null, null, msgId, ...]
					const assistantWrapper = messagePair[3];
					const assistantTimestampData = messagePair[4];
					let assistantMsg = null;
					if (Array.isArray(assistantWrapper) && Array.isArray(assistantWrapper[0]) && Array.isArray(assistantWrapper[0][0])) {
						const assistantData = assistantWrapper[0][0];
						// Structure: [msgId, [content], [], null, null, null, true, ...]
						if (Array.isArray(assistantData) && assistantData.length > 1 && Array.isArray(assistantData[1]) && typeof assistantData[1][0] === 'string') {
							const assistantText = assistantData[1][0];
							// Use only the first part of the timestamp array as the timestamp
							const timestamp = (Array.isArray(assistantTimestampData) && typeof assistantTimestampData[0] === 'number')
								? assistantTimestampData[0]
								: undefined;
							assistantMsg = this.createMessage('assistant', assistantText);
							if (timestamp !== undefined) {
								assistantMsg.timestamp = timestamp;
							}
							assistantMsg.metadata = {};
						} else {
							console.warn("Could not extract assistant message text from:", assistantData);
						}
					} else {
						console.warn("Could not extract assistant message wrapper from:", assistantWrapper);
					}

					// Ensure user message always precedes assistant message
					if (userMsg) extractedMessages.push(userMsg);
					if (assistantMsg) extractedMessages.push(assistantMsg);
				}
			} else {
				console.warn("No message pairs found in conversation payload:", conversationPayload);
			}

			return extractedMessages;

		} catch (error) {
			console.error('Error getting conversation data:', error);
			// Use handleModelError to throw a consistent error type
			// If it's already an AIModelError, preserve its code, otherwise use SERVICE_UNAVAILABLE as a general catch-all
			return this.handleModelError(
				`Failed to get conversation data: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof AIModelError ? error.code : ErrorCode.SERVICE_UNAVAILABLE,
				undefined, // No onEvent callback here
				error
			);
		}
	}


	/**
	   * Shares a conversation and gets a shareable URL from Gemini's servers
	   * @param options Configuration options for sharing
	   * @returns A promise that resolves to a shareable URL
	   * @serverOperation This method makes direct API calls to Gemini's servers
	   */
	@serverOperation
	async shareConversation(options?: {
		loadThread?: boolean;
		title?: string;
		modelName?: string;
		language?: string;
		metadata?: GeminiThreadMetadata;
	}): Promise<string> {
		try {
			let shouldLoadThread = options?.loadThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			if (!options) {
				options = {};
			}

			let title = options?.title || ''
			let modelName = options?.modelName || ''
			let language = options?.language || ''

			// Get the metadata either from the thread or from the provided options
			let metadata: GeminiThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();
				// Get the metadata from the current thread
				metadata = this.getGeminiMetadata();

				if (!title) {
					title = this.currentThread?.title || '';
				}
				if (!modelName) {
					modelName = this.currentThread?.metadata?.defaultModel || '';
				}
				if (!language) {
					language = this.currentThread?.metadata?.defaultLang || '';
				}
			} else if (options?.metadata) {

				if (!this.isValidGeminiMetadata(options?.metadata)) {
					return this.handleModelError(
						'Invalid metadata provided for sharing',
						ErrorCode.INVALID_REQUEST
					);
				}
				// Use the provided metadata
				metadata = options.metadata;

				modelName = metadata.defaultModel || '';
				language = metadata.defaultLang || '';

				// // Validate the provided metadata
				// if (!metadata?.contextIds || metadata.contextIds.length < 3 || !metadata.requestParams?.atValue || !metadata.requestParams?.blValue) {
				//   return this.handleModelError(
				//     'Invalid metadata provided for sharing',
				//     ErrorCode.INVALID_REQUEST
				//   );
				// }
			} else {
				// No thread loaded and no metadata provided
				return this.handleModelError(
					'No thread loaded and no metadata provided for sharing',
					ErrorCode.INVALID_REQUEST
				);
			}

			if (!title) {
				console.warn('Title is required when sharing a conversation, but not provided or is blank. Using "Untitled Conversation" as title.');
				title = 'Untitled Conversation';
			}
			if (!modelName) {
				console.warn('Model name is required when sharing a conversation, but not provided. Using default model name "2.0 Flash".');
				modelName = '2.0 Flash';
			}
			if (!language) {
				console.warn('Language is required when sharing a conversation, but not provided. Using default language "en".');
				language = 'en';
			}

			const payload = [
				[
					[
						"fuVx7",
						JSON.stringify([
							null,
							metadata.contextIds[0], // Variable for c_...
							null,
							metadata.contextIds[2], // Variable for rc_...
							[1, title + '\n', null, null, null, ["", "", ""], null, [null, null, modelName]], // Variables for title and modelName
							[language], // Variable for language
							0,
						]),
						null,
						"generic",
					],
				],
			];

			const body = new URLSearchParams({
				"f.req": JSON.stringify(payload),
				"at": metadata.requestParams.atValue,
			});

			const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?${new URLSearchParams({
				rpcids: "fuVx7",
				"source-path": `/app/${metadata.contextIds[0].substring(2)}`,
				bl: metadata.requestParams.blValue,
				"f.sid": metadata.requestParams.sid,
				hl: options.language || 'en',
				_reqid: String(generateReqId()),
				rt: "c"
			})}`;
			// Send the POST request
			const response = await ofetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
				body: body + "&",
				parseResponse: txt => txt,
				onResponse: ({ response }) => {
					if (!response.ok) {
						return this.handleModelError(
							`Failed to share conversation: ${response.status}`,
							ErrorCode.SERVICE_UNAVAILABLE,
							undefined,
							response.statusText
						);
					}
				}
			});
			const responseText: string = response;

			const lines = responseText.split("\n");
			const jsonLine = lines.find(line => line.includes("\"wrb.fr\""));
			if (!jsonLine) {
				return this.handleModelError("Failed to parse Gemini share response", ErrorCode.RESPONSE_PARSING_ERROR);
			}
			console.log(jsonLine);
			let shareId = "";
			try {
				const arr = JSON.parse(jsonLine);
				console.log(arr);
				if (arr[0]) {
					if (Array.isArray(arr[0]) && arr[0][2]) {
						const inner = JSON.parse(arr[0][2]);
						if (Array.isArray(inner) && inner[2]) {
							shareId = inner[2];
						}
					}
				}

			} catch (e) {
				return this.handleModelError("Error extracting share ID from Gemini response", ErrorCode.RESPONSE_PARSING_ERROR, undefined, e);
			}

			if (!shareId) {
				return this.handleModelError("No share ID found in Gemini response", ErrorCode.RESPONSE_PARSING_ERROR);
			}

			const shareUrl = `https://g.co/gemini/share/${shareId}`

			if (shouldLoadThread && this.currentThread && this.currentThread.metadata) {
				this.currentThread.metadata.shareUrl = shareUrl;
				await this.saveThread();
			}

			return shareUrl;

		} catch (error) {
			// Handle any errors that occurred during the sharing process
			return this.handleModelError(
				'Error sharing conversation',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}

	/**
	   * un-shares a conversation from Gemini's servers
	   * @param options Configuration options for un-sharing
	   * @returns A promise that resolves to a shareable URL
	   * @serverOperation This method makes direct API calls to Gemini's servers
	   */
	@serverOperation
	async unShareConversation(options?: {
		loadThread?: boolean;
		updateThread?: boolean;
		metadata?: GeminiThreadMetadata;
	}): Promise<boolean> {
		try {
			let result = false;
			let shouldLoadThread = options?.loadThread !== false;
			let shouldUpdateThread = options?.updateThread !== false;
			// Default to loading the thread if not specified
			if (options?.metadata) {
				shouldLoadThread = false;
			}

			if (!options) {
				options = {};
			}

			// Get the metadata either from the thread or from the provided options
			let metadata: GeminiThreadMetadata;

			if (shouldLoadThread) {
				// Make sure we have a valid thread
				await this.ensureThreadLoaded();

				// Get the metadata from the current thread
				metadata = this.getGeminiMetadata();

			} else if (options?.metadata) {

				if (shouldUpdateThread) {
					return this.handleModelError(
						'Cannot update thread when LoadThread option is false (updateThread option is not supported)',
						ErrorCode.INVALID_REQUEST
					)
				}

				if (!this.isValidGeminiMetadata(options?.metadata)) {
					return this.handleModelError(
						'Invalid metadata provided for sharing',
						ErrorCode.INVALID_REQUEST
					);
				}
				// Use the provided metadata
				metadata = options.metadata;

			} else {
				// No thread loaded and no metadata provided
				return this.handleModelError(
					'No thread loaded and no metadata provided for sharing',
					ErrorCode.INVALID_REQUEST
				);
			}

			if (!metadata.shareUrl || !metadata?.shareUrl.includes("https://g.co/gemini/share/")) {
				return this.handleModelError(
					'No share URL found in metadata',
					ErrorCode.INVALID_REQUEST
				);
			}


			const payload = [
				[
					[
						"SgORbf",
						JSON.stringify([
							null,
							metadata.shareUrl.replace("https://g.co/gemini/share/", ""), // Variable for c_...
						]),
						null,
						"generic",
					],
				],
			];

			const body = new URLSearchParams({
				"f.req": JSON.stringify(payload),
				"at": metadata.requestParams.atValue,
			});

			const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?${new URLSearchParams({
				rpcids: "fuVx7",
				"source-path": `/app/${metadata.shareUrl.replace("https://g.co/gemini/share/", "")}`,
				bl: metadata.requestParams.blValue,
				"f.sid": metadata.requestParams.sid,
				hl: metadata.defaultLang || 'en',
				_reqid: String(generateReqId()),
				rt: "c"
			})}`;
			// Send the POST request
			const response = await ofetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
				body: body + "&",
				parseResponse: txt => txt,
				onResponse: ({ response }) => {
					if (!response.ok) {
						return this.handleModelError(
							`Failed to un-share conversation: ${response.status}`,
							ErrorCode.SERVICE_UNAVAILABLE,
							undefined,
							response.statusText
						);
					}
				}
			});
			const responseText: string = response;

			const lines = responseText.split("\n");
			const jsonLine = lines.find(line => line.includes("\"wrb.fr\""));
			if (!jsonLine) {
				return this.handleModelError("Failed to parse Gemini un-share response", ErrorCode.RESPONSE_PARSING_ERROR);
			}
			console.log(jsonLine);
			try {
				const arr = JSON.parse(jsonLine);
				console.log(arr);
				if (arr[0]) {
					if (Array.isArray(arr[0]) && arr[0][2]) {
						result = arr[0][2] === '[]'
						if (result && shouldUpdateThread && this.currentThread && this.currentThread.metadata) {
							this.currentThread.metadata.shareUrl = '';
							await this.saveThread();
						}
						return result;
					}
				}

			} catch (e) {
				return this.handleModelError("Failed to parse Gemini un-share response", ErrorCode.RESPONSE_PARSING_ERROR, undefined, e);
			}

			return result;

		} catch (error) {
			// Handle any errors that occurred during the sharing process
			return this.handleModelError(
				'Error sharing conversation',
				ErrorCode.SERVICE_UNAVAILABLE,
				undefined,
				error
			);
		}
	}
}
