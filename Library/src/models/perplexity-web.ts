import { ofetch, FetchError } from 'ofetch';
import { v4 as uuid } from 'uuid';
import { AbstractModel } from './abstract-model';
import { AIModelError, ChatMessage, ChatThread, ErrorCode, StatusEvent } from './types';
import { requestHostPermission } from '../utils/auth';
import { c } from 'ofetch/dist/shared/ofetch.d0b3d489';

/**
 * Decorator for methods that interact directly with the Perplexity server
 */
function serverOperation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    return descriptor;
}

interface PerplexityWebModelConfig {
    sessionKey?: string;
}

interface PerplexityThreadMetadata {
    conversationId: string;
    threadUrlSlug?: string;
    frontendContextUuid?: string;
    backendUuid?: string;
    contextUuid?: string;
    readWriteToken?: string;
}

interface PerplexityUserInfo {
    id: string;
    username: string;
    image: string;
    subscriptionStatus: string;
}

interface PerplexityCSRFResponse {
    csrfToken: string;
}

interface PerplexityUserSettings {
    gpt4_limit: number;
    pages_limit: number;
    upload_limit: number;
    subscription_status: string;
    subscription_tier: string;
    query_count: number;
    // ... other fields
}

interface PerplexityRateLimitResponse {
    remaining: number;
}

export class PerplexityWebModel extends AbstractModel {

    private csrfToken?: string;
    private userInfo?: PerplexityUserInfo;
    private userSettings?: PerplexityUserSettings;
    private visitorId: string;
    private sessionKey?: string;

    constructor(config: PerplexityWebModelConfig = {}) {
        super();
        this.sessionKey = config.sessionKey;
        this.baseUrl = 'https://www.perplexity.ai';
        this.visitorId = uuid();
        this.models = {
            'Perplexity Sonar': ['turbo', 'concise', 'non-reasoning', 'non-pro'],
            'Perplexity Pro Auto': ['pplx_pro', 'copilot', 'non-reasoning', 'pro-limited'],
            'Perplexity Sonar Pro': ['experimental', 'copilot', 'non-reasoning', 'pro-account'],
            'GPT-4.1': ['gpt4o', 'copilot', 'non-reasoning', 'pro-account'],
            'Claude 3.7 Sonnet': ['claude2', 'copilot', 'non-reasoning', 'pro-account'],
            'Gemini 2.5 Pro': ['gemini2flash', 'copilot', 'non-reasoning', 'pro-account'],
            'Grok 3 Beta': ['grok', 'copilot', 'non-reasoning', 'pro-account'],
            'Perplexity R1 1776': ['r1', 'copilot', 'reasoning', 'pro-account'],
            'GPT-o4-mini': ['o3mini', 'copilot', 'reasoning', 'pro-account'],
            'Claude 3.7 Sonnet Thinking': ['claude37sonnetthinking', 'copilot', 'reasoning', 'pro-account'],
            'Perplexity Deep Research': ['pplx_alpha', 'copilot', 'reasoning', 'pro-limited'],
        };
        this.defaultModel = 'Perplexity Sonar';
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
            if (thread.modelName === this.getName() && !this.isValidPerplexityMetadata(thread.metadata)) {
                await this.deleteThread(thread.id);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await this.saveThreadsToStorage(threads.filter(t =>
                t.modelName !== this.getName() || this.isValidPerplexityMetadata(t.metadata)
            ));
        }
    }

    private isValidPerplexityMetadata(metadata: any): metadata is PerplexityThreadMetadata {
        return metadata?.conversationId;
    }

    getName(): string {
        return 'Perplexity Web';
    }

    getModels(): Record<string, Record<string, string[]>> {
        return this.models;
    }

    getSearchSources(): string[] {
        return ['web', 'scholar', 'social'];
    }

    supportsImageInput(): boolean {
        return true; // Perplexity now supports image input
    }

    /**
     * Uploads an image to Perplexity's backend (Cloudinary)
     * @param imageFile The image file to upload
     * @returns The secure URL of the uploaded image
     * @serverOperation
     */
    @serverOperation
    private async uploadImage(imageFile: File): Promise<string> {
        try {
            // Step 1: Get upload URL and parameters from Perplexity
            const createUploadUrl = `${this.baseUrl}/rest/uploads/create_upload_url`;
            const createPayload = {
                filename: imageFile.name,
                content_type: imageFile.type,
                source: "default",
                file_size: imageFile.size,
                force_image: false // Assuming default behavior
            };

            // Ensure CSRF token is available
            if (!this.csrfToken) {
                await this.checkAuth(); // checkAuth fetches the CSRF token
                if (!this.csrfToken) {
                    return this.handleModelError('Failed to obtain CSRF token for upload', ErrorCode.UNAUTHORIZED);
                }
            }

            const uploadParamsResponse = await ofetch<{ s3_bucket_url: string; fields: Record<string, any> }>(createUploadUrl, {
                method: 'POST',
                headers: this.getHeaders(true), // Include CSRF token
                body: JSON.stringify(createPayload),
            });

            if (!uploadParamsResponse || !uploadParamsResponse.s3_bucket_url || !uploadParamsResponse.fields) {
                return this.handleModelError('Failed to get upload parameters from Perplexity', ErrorCode.UPLOAD_FAILED);
            }

            // Step 2: Upload the image to Cloudinary using the obtained parameters
            const cloudinaryUrl = uploadParamsResponse.s3_bucket_url;
            const formData = new FormData();

            // Append all fields from the response
            for (const key in uploadParamsResponse.fields) {
                formData.append(key, uploadParamsResponse.fields[key]);
            }
            // Append the file itself
            formData.append('file', imageFile);

            const cloudinaryResponse = await ofetch<{ secure_url: string }>(cloudinaryUrl, {
                method: 'POST',
                // Do NOT set Content-Type header for FormData, browser does it with boundary
                // headers: { ... }, // No custom headers needed usually for direct Cloudinary upload like this
                body: formData,
            });

            if (!cloudinaryResponse || !cloudinaryResponse.secure_url) {
                return this.handleModelError('Failed to upload image to Cloudinary or parse response', ErrorCode.UPLOAD_FAILED);
            }

            console.log('Image uploaded successfully:', cloudinaryResponse.secure_url);
            return cloudinaryResponse.secure_url;

        } catch (error) {
            console.error('Perplexity image upload error:', error);
            // Rethrow specific errors or a generic upload error
            // No need to handle AIModelError specially since we're using handleModelError
            // which will properly handle all error types
            // Use handleModelError instead of direct throw
            return this.handleModelError(
                `Image upload failed: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.UPLOAD_FAILED,
                undefined,
                error
            );
        }
    }

    // Get headers for Perplexity API requests
    private getHeaders(includeCSRF = false): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        if (this.sessionKey) {
            headers.Cookie = `__Secure-next-auth.session-token=${this.sessionKey}`;
        }

        if (includeCSRF && this.csrfToken) {
            headers['x-csrf-token'] = this.csrfToken;
        }

        return headers;
    }

    /**
     * Check if user is authenticated with Perplexity
     * @returns User info if authenticated, null otherwise
     */
    @serverOperation
    private async checkAuth(): Promise<PerplexityUserInfo | null> {
        try {
            // Check for permission first
            if (!(await requestHostPermission(`${this.baseUrl}/`))) {
                return this.handleModelError(`Missing ${this.baseUrl} permission`, ErrorCode.MISSING_HOST_PERMISSION);
            }

            // Get CSRF token first
            const csrfResponse = await ofetch<PerplexityCSRFResponse>(`${this.baseUrl}/api/auth/csrf`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (csrfResponse && csrfResponse.csrfToken) {
                this.csrfToken = csrfResponse.csrfToken;
            }

            // Get session info
            const response = await ofetch(`${this.baseUrl}/api/auth/session`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (response && response.user) {
                this.userInfo = {
                    id: response.user.id,
                    username: response.user.name,
                    image: response.user.image,
                    subscriptionStatus: response.user.subscription_status || 'unknown',
                };

                // Get additional user settings
                try {
                    const settings = await ofetch<PerplexityUserSettings>(`${this.baseUrl}/rest/user/settings`, {
                        method: 'GET',
                        headers: this.getHeaders(true),
                    });

                    if (settings) {
                        this.userSettings = settings;
                    }
                } catch (error) {
                    console.warn('Failed to get user settings:', error);
                }

                return this.userInfo;
            }

            return null;
        } catch (error) {
            if (error instanceof FetchError && error.status === 401) {
                return null;
            }
            return this.handleModelError(
                'Failed to check authentication with Perplexity',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }

    /**
     * Check rate limits for Perplexity
     * @returns Remaining queries count
     */
    @serverOperation
    private async checkRateLimit(): Promise<number> {
        try {
            const response = await ofetch<PerplexityRateLimitResponse>(`${this.baseUrl}/rest/rate-limit`, {
                method: 'GET',
                headers: this.getHeaders(true),
            });

            return response.remaining;
        } catch (error) {
        	// Use handleModelError, but catch immediately if the calling code
        	// might handle an unknown limit gracefully. For now, let it throw.
        	return this.handleModelError(
        		'Failed to check rate limit',
        		ErrorCode.SERVICE_UNAVAILABLE,
        		undefined,
        		error
        	);
        }
       }

    /**
     * Get recent threads from Perplexity
     */
    @serverOperation
    private async getRecentThreads(): Promise<any[]> {
        try {
            const response = await ofetch<any>(`${this.baseUrl}/rest/thread/list_recent`, {
                method: 'GET',
                headers: this.getHeaders(true),
            });

            return response.entries || [];
        } catch (error) {
        	// Use handleModelError for consistency.
        	return this.handleModelError(
        		'Failed to get recent threads',
        		ErrorCode.SERVICE_UNAVAILABLE,
        		undefined,
        		error
        	);
        }
       }

    // Ensure thread is loaded before sending messages
    private async ensureThreadLoaded(): Promise<void> {
        if (!this.currentThread) {
            // Try to load the most recent thread for this model
            const threads = await this.getAllThreads();
            const perplexityThreads = threads.filter(t =>
                t.modelName === this.getName() && this.isValidPerplexityMetadata(t.metadata)
            );

            if (perplexityThreads.length > 0) {
                // Sort by most recent and use that thread
                const mostRecentThread = perplexityThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                this.currentThread = mostRecentThread;
                console.log('Loaded existing thread from storage:', this.currentThread.id);
            } else {
                // Create a new thread if none exists
                await this.initNewThread();
            }
        }
    }

    // Get Perplexity-specific metadata from the current thread
    private getPerplexityMetadata(): PerplexityThreadMetadata {
        const currentThread = this.getCurrentThreadSafe();

        if (!currentThread.metadata) {
            return this.handleModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
        }

        const metadata = currentThread.metadata as PerplexityThreadMetadata;
        if (!metadata.conversationId) {
            return this.handleModelError('Invalid thread metadata', ErrorCode.INVALID_REQUEST);
        }

        return metadata;
    }

    // Get the current thread or throw an error if none exists
    private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
        if (!this.currentThread) {
            return this.handleModelError('No active thread', ErrorCode.INVALID_REQUEST);
        }
        return this.currentThread;
    }

    // Initialize a new thread
    async initNewThread(): Promise<void> {
        try {
            // Check if user is authenticated
            const userInfo = await this.checkAuth();

            // Generate UUIDs for the new conversation
            const conversationId = uuid();
            const frontendContextUuid = uuid();

            this.currentThread = {
                id: conversationId,
                title: 'New Conversation',
                modelName: this.getName(),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    conversationId,
                    frontendContextUuid
                }
            };

            await this.saveThread();
        } catch (error) {
            return this.handleModelError(
                'Error initializing new thread',
                ErrorCode.METADATA_INITIALIZATION_ERROR,
                undefined,
                error
            );
        }
    }

    // Load a specific thread
    async loadThread(threadId: string): Promise<void> {
        const threads = await this.getAllThreads();
        const thread = threads.find(t => t.id === threadId);

        if (thread && thread.modelName === this.getName()) {
            this.currentThread = thread;
        } else {
            return this.handleModelError(
                `Thread ${threadId} not found`,
                ErrorCode.INVALID_THREAD_ID
            );
        }
    }

    // Send a message to Perplexity
    protected async doSendMessage(params: {
        prompt: string;
        images?: File[]; // Updated from image?: File
        model?: string;
        signal?: AbortSignal;
        searchFocus?: string;
        searchSources?: string[];
        onEvent: (event: StatusEvent) => void;
    }): Promise<void> {

        let searchSource: string[] = [];
        let currentModel = this.defaultModel;

        if (params.model) {
            if (this.models[params.model]) {
                currentModel = params.model;
            } else {
                console.warn(`Invalid model "${params.model}" provided. Using default model "${currentModel}" instead.`);
            }
        } else {
            console.log(`No model provided, using default model "${currentModel}".`);
        }

        let searchFocus = "internet";
        if (params.searchFocus) {
            if (params.searchFocus === "internet" || params.searchFocus === "writing") {
                searchFocus = params.searchFocus;
            } else {
                console.warn(`Invalid search focus "${params.searchFocus}" provided. Using default mode "internet" instead.`);
            }
        } else {
            console.log('No search focus provided, using default "internet" mode');
        }

        if (params.searchFocus === "internet") {
            if (params.searchSources) {
                if (!(params.searchSources.every(item => this.getSearchSources().includes(item)))) {
                    console.warn(`Invalid search source(s) "${params.searchSources}" provided. Using default source "web" instead.`);
                } else {
                    searchSource = params.searchSources;
                }
            } else {
                console.log('No search source provided, using default source "web".');
                searchSource = ["web"];
            }
        } else {
            if (params.searchSources || params.searchSources != "") {
                console.warn(`Invalid search source(s) "${params.searchSources}" provided for a no internet search response. Ignoring search sources.`);
            }
        }


        try {
            params.onEvent({
                type: 'UPDATE_ANSWER',
                data: { text: '' }
            });

            // Make sure we have a valid thread with the latest data from storage
            await this.ensureThreadLoaded();

            // Now we can safely assert that currentThread exists
            const currentThread = this.getCurrentThreadSafe();


            // --- Handle Image Uploads ---
            let attachmentUrls: string[] = [];
            if (params.images && params.images.length > 0) {
                if (params.images.length > 4) {
                    return this.handleModelError(
                        'Maximum of 4 images allowed per message.',
                        ErrorCode.UPLOAD_AMOUNT_EXCEEDED,
                        params
                    );
                }
                // Upload images sequentially (could be parallelized if needed)
                for (const imageFile of params.images) {
                    try {
                        const imageUrl = await this.uploadImage(imageFile);
                        attachmentUrls.push(imageUrl);
                    } catch (uploadError) {
                        // If one upload fails, stop and report error
                        return this.handleModelError(
                            `Failed to upload image: ${imageFile.name}`,
                            ErrorCode.UPLOAD_FAILED,
                            params,
                            uploadError
                        );
                    }
                }
            }
            // --- End Image Uploads ---


            // Add user message to thread *before* getting metadata for checks
            // Include image URLs in metadata for potential display later
            const userMessage = this.createMessage('user', params.prompt);
            if (attachmentUrls.length > 0) {
                userMessage.metadata = { ...(userMessage.metadata || {}), attachmentUrls };
            }
            currentThread.messages.push(userMessage);


            // Re-fetch metadata AFTER potentially modifying it in ensureThreadLoaded or initNewThread
            // Use try-catch as getPerplexityMetadata can throw if metadata is invalid/missing initially
            let metadata: PerplexityThreadMetadata;
            try {
                metadata = this.getPerplexityMetadata();
            } catch (e) {
                // Handle cases where metadata might be missing after init, should have defaults though
                if (this.currentThread?.metadata) {
                    metadata = this.currentThread.metadata as PerplexityThreadMetadata;
                } else {
                    // This should ideally not happen if initNewThread works correctly
                    return this.handleModelError(
                        'Failed to initialize thread metadata',
                        ErrorCode.METADATA_INITIALIZATION_ERROR,
                        params,
                        e
                    );
                }
            }

            // Check if user is authenticated
            const userInfo = await this.checkAuth();

            // Check rate limit
            const rateLimit = await this.checkRateLimit();
            if (rateLimit <= 0) {
                return this.handleModelError(
                    'You have reached your rate limit for Perplexity queries',
                    ErrorCode.RATE_LIMIT_EXCEEDED
                );
            }

            // --- Prepare the search request payload ---
            const frontendUuid = uuid(); // Generate a new frontend UUID for each request

            // Determine if it's the first message or a follow-up
            // Check if essential follow-up metadata exists *and* there are previous messages
            const isFollowUp = currentThread.messages.length > 1 && metadata.backendUuid && metadata.readWriteToken;

            const baseParams = {
                attachments: attachmentUrls, // Use the uploaded image URLs
                browser_history_summary: [],
                client_coordinates: null,
                // frontend_context_uuid: // Added conditionally below
                frontend_uuid: frontendUuid,
                is_incognito: false,
                is_nav_suggestions_disabled: false,
                is_related_query: false,
                is_sponsored: false,
                language: navigator.language || 'en-US',
                mode: this.models[currentModel][1], // Or read from user settings?
                model_preference: this.models[currentModel][0], // Or read from user settings?
                prompt_source: "user",
                // query_source: // Added conditionally below
                search_focus: searchFocus,
                search_recency_filter: null,
                send_back_text_in_streaming_api: false,
                sources: searchSource,
                supported_block_use_cases: [
                    "answer_modes", "media_items", "knowledge_cards", "inline_entity_cards",
                    "place_widgets", "finance_widgets", "sports_widgets", "shopping_widgets",
                    "jobs_widgets", "search_result_widgets", "entity_list_answer", "todo_list"
                ],
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                use_schematized_api: true,
                user_nextauth_id: userInfo?.id,
                version: "2.18", // Should ideally fetch this dynamically if possible
                visitor_id: this.visitorId
                // last_backend_uuid: // Added conditionally below
                // read_write_token: // Added conditionally below
            };

            let specificParams: Partial<typeof baseParams> & {
                last_backend_uuid?: string;
                read_write_token?: string;
                frontend_context_uuid?: string;
                query_source?: string;
            };

            if (isFollowUp) {
                // Follow-up message payload adjustments
                specificParams = {
                    last_backend_uuid: metadata.backendUuid,
                    read_write_token: metadata.readWriteToken,
                    query_source: "followup"
                };
                console.log('Sending follow-up request with backendUuid:', metadata.backendUuid);
            } else {
                // First message payload adjustments
                specificParams = {
                    frontend_context_uuid: metadata.frontendContextUuid || uuid(), // Ensure fallback if missing somehow
                    query_source: "home"
                };
                console.log('Sending first request with frontendContextUuid:', specificParams.frontend_context_uuid);
            }

            const payload = {
                params: { ...baseParams, ...specificParams },
                query_str: params.prompt
            };
            // --- End Payload Preparation ---


            // Send the request to Perplexity
            const response = await fetch(`${this.baseUrl}/rest/sse/perplexity_ask`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify(payload),
                signal: params.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();

                if (response.status === 429) {
                    return this.handleModelError(
                        'Perplexity rate limit exceeded. Please try again later.',
                        ErrorCode.RATE_LIMIT_EXCEEDED,
                        params
                    );
                } else {
                    return this.handleModelError(
                        `Perplexity API error: ${response.status} - ${errorText.substring(0, 200)}`,
                        ErrorCode.SERVICE_UNAVAILABLE,
                        params
                    );
                }
            }

            if (!response.body) {
                return this.handleModelError('Response body is null', ErrorCode.SERVICE_UNAVAILABLE, params);
            }

            // Process the streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';
            let threadUrlSlug = metadata.threadUrlSlug || ''; // Initialize from existing metadata if available
            let backendUuid = metadata.backendUuid || '';
            let contextUuid = metadata.contextUuid || '';
            let readWriteToken = metadata.readWriteToken || '';

            // Process the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Log received chunks for debugging
                console.log('Perplexity chunk received:', chunk.length);

                // Process line by line
                let eolIndex;
                while ((eolIndex = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, eolIndex).trim();
                    buffer = buffer.slice(eolIndex + 1);

                    // Skip empty lines
                    if (!line) continue;

                    if (line.startsWith('event:')) {
                        const eventType = line.substring('event:'.length).trim();

                        // Read the next line for data
                        let dataEolIndex = buffer.indexOf('\n');
                        if (dataEolIndex >= 0) {
                            const dataLine = buffer.slice(0, dataEolIndex).trim();
                            buffer = buffer.slice(dataEolIndex + 1); // Consume the data line from buffer

                            if (dataLine.startsWith('data:')) {
                                const dataJson = dataLine.substring('data:'.length).trim();

                                if (eventType === 'end_of_stream') {
                                    console.log('Perplexity end_of_stream received');
                                    // We might receive final data in the last 'message' event, so don't break here immediately
                                    // Break will happen naturally when reader is done.
                                    continue;
                                }

                                if (eventType === 'message') {
                                    try {
                                        const data = JSON.parse(dataJson);
                                        let textUpdated = false;

                                        // --- Extract Metadata ---
                                        if (data.thread_url_slug && !threadUrlSlug) {
                                            threadUrlSlug = data.thread_url_slug;
                                            metadata.threadUrlSlug = threadUrlSlug;
                                        }
                                        if (data.backend_uuid && !backendUuid) {
                                            backendUuid = data.backend_uuid;
                                            metadata.backendUuid = backendUuid;
                                        }
                                        // Use context_uuid from message data primarily
                                        if (data.context_uuid) {
                                            contextUuid = data.context_uuid;
                                            metadata.contextUuid = contextUuid;
                                        }

                                        // // --- Check for answer text in various locations ---
                                        // // 1. Check for direct answer text in the response
                                        // if (data.answer && typeof data.answer === 'string' && data.answer.trim() !== '') {
                                        //     fullText = data.answer;
                                        //     textUpdated = true;
                                        // }

                                        // --- Process Text Blocks ---
                                        if (data.blocks && Array.isArray(data.blocks)) {
                                            for (const block of data.blocks) {
                                                // Handle markdown blocks (main text content)
                                                if (block.intended_usage === 'ask_text' && block.markdown_block) {
                                                    const markdownBlock = block.markdown_block;
                                                    // Prioritize 'answer' as it seems to be the complete text so far
                                                    // if (typeof markdownBlock.answer === 'string') {
                                                    //     // Replace the full text instead of appending to prevent duplication
                                                    //     fullText = markdownBlock.answer;
                                                    //     textUpdated = true;
                                                    // } else
                                                    if (Array.isArray(markdownBlock.chunks) && markdownBlock.chunks.length == 1) {
                                                        // Only use chunks if we don't have a complete answer yet
                                                        fullText += markdownBlock.chunks[0];
                                                        textUpdated = true;
                                                    }
                                                }
                                                // Handle sources_answer_mode blocks
                                                // else if (block.intended_usage === 'sources_answer_mode' && block.sources_mode_block) {
                                                //     const sourcesBlock = block.sources_mode_block;
                                                //     if (sourcesBlock.answer && typeof sourcesBlock.answer === 'string' && sourcesBlock.answer.trim() !== '') {
                                                //         fullText = sourcesBlock.answer;
                                                //         textUpdated = true;
                                                //     }
                                                // }
                                                // // Handle text directly in the block
                                                // else if (block.text && typeof block.text === 'string' && block.text.trim() !== '') {
                                                //     fullText += block.text;
                                                //     textUpdated = true;
                                                // }
                                            }
                                        }

                                        // // Also check for direct text in the response (some message formats), but ignore if it's the final message
                                        // if (data.text && typeof data.text === 'string' && data.text.trim() !== '' && data.text !== fullText && !data.final && !data.final_sse_message) {
                                        //     // This might be an older format or edge case, append instead of replacing
                                        //     // If this causes issues, consider removing this block entirely
                                        //     fullText += data.text;
                                        //     textUpdated = true;
                                        // }

                                        // Send text update if it changed
                                        if (textUpdated) {
                                            // Always send update events for streaming experience
                                            params.onEvent({
                                                type: 'UPDATE_ANSWER',
                                                data: { text: fullText }
                                            });

                                            // Log for debugging
                                            console.log('Perplexity text update:', fullText.length);
                                        }

                                        // --- Handle Final Message ---
                                        if (data.final === true || data.final_sse_message === true) {
                                            // Update title if present in this final chunk
                                            if (data.thread_title && data.thread_title !== currentThread.title) {
                                                currentThread.title = data.thread_title;
                                                params.onEvent({
                                                    type: 'TITLE_UPDATE',
                                                    data: {
                                                        title: data.thread_title,
                                                        threadId: currentThread.id
                                                    }
                                                });
                                            }
                                            // Extract readWriteToken specifically from the final message
                                            if (data.read_write_token) {
                                                readWriteToken = data.read_write_token;
                                                metadata.readWriteToken = readWriteToken;
                                            }
                                            // Extract related queries if present in the final chunk
                                            if (data.related_queries && Array.isArray(data.related_queries)) {
                                                params.onEvent({
                                                    type: 'SUGGESTED_RESPONSES',
                                                    data: {
                                                        suggestions: data.related_queries.map((q: any) => typeof q === 'string' ? q : q.text).filter(Boolean)
                                                    }
                                                });
                                            }
                                        }

                                    } catch (e) {
                                        console.warn('Error parsing Perplexity message data JSON:', dataJson, e);
                                    }
                                }
                            }
                        } else {
                            // Data line not yet complete in buffer, put event line back
                            buffer = line + '\n' + buffer;
                            break; // Wait for more data
                        }
                    }
                }
            }

            // Stream has finished
            console.log('Perplexity stream finished, final text length:', fullText.length);

            // Add the final assistant message to the thread without sending another update
            // This prevents duplicate text since the last UPDATE_ANSWER already contains the complete text
            const assistantMessage = this.createMessage('assistant', fullText); // Ensure content is not empty
            currentThread.messages.push(assistantMessage);

            // Update thread metadata and save (metadata object was updated directly during stream)
            currentThread.updatedAt = Date.now();
            // Metadata object linked to currentThread was updated in place, no need to reassign
            // currentThread.metadata = metadata; // Not needed if metadata === currentThread.metadata

            await this.saveThread();

            // Send final DONE event
            params.onEvent({
                type: 'DONE',
                data: {
                    threadId: currentThread.id,
                    // You could optionally include final metadata here if needed by UI
                    // metadata: { ...metadata }
                }
            });

        } catch (error) {
            // With the improved handleModelError, we don't need to log after as it always throws
            return this.handleModelError(
                'Error sending message',
                ErrorCode.SERVICE_UNAVAILABLE,
                params,
                error
            );
        }
    }


    async getModelVersion(): Promise<string> {
        try {
            const response = await ofetch(`${this.baseUrl}/rest/version`, {
                method: 'GET',
                headers: this.getHeaders(true),
            });

            if (response && response.version) {
                return response.version;
            } else {
                return this.handleModelError(
                    'Invalid response from Perplexity version endpoint',
                    ErrorCode.SERVICE_UNAVAILABLE
                );
            }

        } catch (error) {
            return this.handleModelError(
                'Error fetching Perplexity version',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }


    /**
     * Deletes a conversation from Perplexity's servers
     * @param threadId The thread ID to delete
     * @returns Response data from the server
     * @serverOperation This method makes direct API calls to Perplexity's servers
     */
    @serverOperation
    async deleteServerThreads(threadIds: string[], updateLocalThread: boolean = true, createNewThreadAfterDelete: boolean = true): Promise<void> {
        try {
            // Check if user is authenticated
            const userInfo = await this.checkAuth();
            if (!userInfo) {
                return this.handleModelError(
                    'You must be logged in to delete conversations',
                    ErrorCode.UNAUTHORIZED
                );
            }

            const allThreads = await this.getAllThreads();

            // Process each thread ID
            for (const threadId of threadIds) {
                try {
                    const thread = allThreads.find(t => t.id === threadId);

                    if (!thread) {
                        console.warn(`Thread ${threadId} not found in storage.`);
                        continue;
                    }

                    // Check model name directly on the found thread
                    if (thread.modelName !== this.getName()) {
                        console.warn(`Thread ${threadId} has incorrect model name: ${thread.modelName}`);
                        continue;
                    }

                    const metadata = thread.metadata as PerplexityThreadMetadata;
                    if (!metadata || !metadata.backendUuid || !metadata.readWriteToken) {
                        // If we don't have the necessary metadata, we can't delete it from the server
                        // Just delete it from local storage
                        if (updateLocalThread) {
                            console.warn(`Thread ${threadId} has incomplete metadata. Cannot delete from server, deleting only from local storage.`);
                            await this.deleteThread(threadId);
                        }
                        else {
                            console.warn(`Thread ${threadId} has incomplete metadata. Cannot delete from server, skipping thread.`);
                        }
                        continue;
                    }

                    // Delete the thread from Perplexity's servers using the correct endpoint
                    let resp = await ofetch(`${this.baseUrl}/rest/thread/delete_thread_by_entry_uuid`, {
                        method: 'DELETE',
                        headers: this.getHeaders(true),
                        body: JSON.stringify({
                            entry_uuid: metadata.backendUuid,
                            read_write_token: metadata.readWriteToken
                        }),
                    });

                    if (!resp || resp.status !== 'success') {
                        return this.handleModelError(
                            `Failed to delete thread ${threadId} from Perplexity`,
                            ErrorCode.SERVICE_UNAVAILABLE,
                            undefined,
                            resp?.detail || 'Unknown error'
                        );
                    }

                    // Delete from local storage
                    if (updateLocalThread) {
                        await this.deleteThread(threadId, createNewThreadAfterDelete);
                    }

                } catch (threadError) {
                    console.error(`Error deleting thread ${threadId}:`, threadError);
                    // Continue with next thread even if one fails
                }
               }
              } catch (error) {
               return this.handleModelError(
                   'Error deleting conversations',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
               );
              }
             }


    /**
     * Shares a conversation from Perplexity
     * @returns A shareable URL
     * @serverOperation This method makes direct API calls to Perplexity's servers
     */
    @serverOperation
    async shareConversation(): Promise<string> {
        try {
            // Make sure we have a valid thread
            await this.ensureThreadLoaded();

            // Get the metadata from the current thread
            const metadata = this.getPerplexityMetadata();

            // Check if user is authenticated
            const userInfo = await this.checkAuth();
            if (!userInfo) {
                return this.handleModelError(
                    'You must be logged in to share conversations',
                    ErrorCode.UNAUTHORIZED
                );
            }

            if (!metadata.contextUuid || !metadata.threadUrlSlug) {
                return this.handleModelError(
                    'This conversation cannot be shared',
                    ErrorCode.FEATURE_NOT_SUPPORTED
                );
            }

            // Update thread access to make it shareable (access level 2)
            const response = await ofetch<{ status: string; access: number }>(
                `${this.baseUrl}/rest/thread/update_thread_access`,
                {
                    method: 'POST',
                    headers: this.getHeaders(true),
                    body: JSON.stringify({
                        context_uuid: metadata.contextUuid,
                        updated_access: 2, // 2 = shareable
                        read_write_token: metadata.readWriteToken
                    }),
                }
            );

            if (response.status !== 'success' || response.access !== 2) {
                return this.handleModelError(
                    'Failed to make conversation shareable',
                    ErrorCode.SERVICE_UNAVAILABLE
                );
            }

            // Construct the shareable URL
            const shareableUrl = `${this.baseUrl}/search/${metadata.threadUrlSlug}`;
            return shareableUrl;
        } catch (error) {
            return this.handleModelError(
                'Error sharing conversation',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }


    /**
     * Sets a conversation to private in Perplexity
     * @returns True if successful
     * @serverOperation This method makes direct API calls to Perplexity's servers
     */
    @serverOperation
    async unShareConversation(): Promise<boolean> {
        try {
            // Make sure we have a valid thread
            await this.ensureThreadLoaded();

            // Get the metadata from the current thread
            const metadata = this.getPerplexityMetadata();

            // Check if user is authenticated
            const userInfo = await this.checkAuth();
            if (!userInfo) {
                return this.handleModelError(
                    'You must be logged in to change conversation visibility',
                    ErrorCode.UNAUTHORIZED
                );
            }

            if (!metadata.contextUuid) {
                return this.handleModelError(
                    'This conversation cannot be modified',
                    ErrorCode.FEATURE_NOT_SUPPORTED
                );
            }

            // Update thread access to make it private (access level 1)
            const response = await ofetch<{ status: string; access: number }>(
                `${this.baseUrl}/rest/thread/update_thread_access`,
                {
                    method: 'POST',
                    headers: this.getHeaders(true),
                    body: JSON.stringify({
                        context_uuid: metadata.contextUuid,
                        updated_access: 1, // 1 = private
                        read_write_token: metadata.readWriteToken
                    }),
                }
            );

            return response.status === 'success' && response.access === 1;
        } catch (error) {
            return this.handleModelError(
                'Error setting conversation to private',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }

    /**
     * Updates the title of a conversation
     * @param newTitle The new title to set for the conversation
     * @serverOperation This method makes direct API calls to Perplexity's servers
     */
    @serverOperation
    async editTitle(newTitle: string): Promise<void> {
        try {
            // Make sure we have a valid thread
            await this.ensureThreadLoaded();

            // Check if user is authenticated
            const userInfo = await this.checkAuth();
            if (!userInfo) {
                return this.handleModelError(
                    'You must be logged in to edit conversation titles',
                    ErrorCode.UNAUTHORIZED
                );
            }

            // Get the metadata from the current thread
            const metadata = this.getPerplexityMetadata();

            if (!metadata.contextUuid) {
                // If we don't have the necessary metadata, we can't update the title on the server
                // Just update it in local storage
                if (this.currentThread) {
                    this.currentThread.title = newTitle;
                    await this.saveThread();
                }
                return;
            }

            // Update the title on Perplexity's servers using the correct endpoint
            await ofetch(`${this.baseUrl}/rest/thread/set_thread_title`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({
                    context_uuid: metadata.contextUuid,
                    title: newTitle,
                    read_write_token: metadata.contextUuid
                }),
            });

            // Update in local storage
            if (this.currentThread) {
                this.currentThread.title = newTitle;
                await this.saveThread();
            }
        } catch (error) {
            return this.handleModelError(
                'Error updating conversation title',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }
}
