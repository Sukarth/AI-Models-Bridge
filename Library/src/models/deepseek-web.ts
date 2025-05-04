import { ofetch, FetchError, FetchOptions, FetchResponse } from 'ofetch';
import { v4 as uuid } from 'uuid';
import { getTokenFromWebsite } from '../utils/auth'; // <-- Import generic auth function
import { solveDeepSeekPowWasm } from '../utils/pow-solver';
import { AbstractModel } from './abstract-model';
import {
    AIModelError,
    ChatMessage,
    ChatThread,
    ErrorCode,
    StatusEvent,
    ParsedModelResponse,
} from './types';
import Browser from 'webextension-polyfill';

/**
 * Decorator for methods that interact directly with the DeepSeek server
 */
function serverOperation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Original method is preserved. This is just for documentation/marking purposes
    return descriptor;
}

/**
 * Metadata specific to DeepSeek Web threads.
 */
interface DeepseekThreadMetadata {
    conversationId: string;
    organizationId?: string; // Although not used by Deepseek, keep structure potentially consistent
    lastMessageId?: number | string | null; // Deepseek seems to use numeric/string message IDs from response
}

export class DeepseekWebModel extends AbstractModel {
    private authToken?: string;
    private readonly DEEPSEEK_HOST = 'https://chat.deepseek.com';

    constructor() {
        super();
        // Initialize asynchronously
        this.initialize().catch(err => {
            console.error('Failed to initialize DeepseekWebModel:', err);
        });
    }

    // --- Initialization ---


    private async initialize(): Promise<void> {
        console.log('Initializing DeepSeek model...');
        try {
            const token = await getTokenFromWebsite(
                'Deepseek',
                this.DEEPSEEK_HOST,
                `${this.DEEPSEEK_HOST}/*`,
                'deepseekExtractor', // <-- Pass extractor name as string
                false // Don't force new tab on initial load
            );
            if (token) {
                this.authToken = `Bearer ${token}`;
                console.log('[Deepseek Init] Auth token loaded.');
            } else {
                console.warn('[Deepseek Init] Auth token not found during initial load.');
            }
            await this.initializeStorage();
            console.log('DeepSeek model ready.');
        } catch (error) {
            // Use handleModelError which will throw
            this.handleModelError('Deepseek Initialization failed', ErrorCode.METADATA_INITIALIZATION_ERROR, undefined, error);
        }
    }

    /**
     * Ensures the authentication token is loaded and valid. Throws if not available after trying.
     */
    private async ensureAuthToken(): Promise<string> {
        if (!this.authToken) {
            console.log("[Deepseek ensureAuthToken] Auth token missing, attempting to retrieve...");
            const token = await getTokenFromWebsite(
                'Deepseek',
                this.DEEPSEEK_HOST,
                `${this.DEEPSEEK_HOST}/*`,
                'deepseekExtractor', // <-- Pass extractor name as string
                true // Force new tab if necessary
            );

            if (token) {
                this.authToken = `Bearer ${token}`;
            } else {
                console.error("[Deepseek ensureAuthToken] Failed to retrieve auth token even after forcing.");
                return this.handleModelError(
                    'DeepSeek authentication token is missing. Please log in to https://chat.deepseek.com.',
                    ErrorCode.UNAUTHORIZED
                );
            }
        }
        return this.authToken;
    }

    /**
     * Initializes local storage for threads and validates existing ones.
     */
    private async initializeStorage(): Promise<void> {
        const threads = await this.getAllThreads();
        if (!threads) {
            console.warn("Could not retrieve threads from storage, starting fresh.");
            await this.saveThreadsToStorage([]);
        } else if (threads.length === 0) {
            await this.saveThreadsToStorage([]);
        }
        await this.validateExistingThreads();
    }

    /**
     * Validates metadata of existing threads stored locally.
     */
    private async validateExistingThreads(): Promise<void> {
        const threads = await this.getAllThreads();
        if (!threads) return;

        let hasChanges = false;
        const validThreads: ChatThread[] = [];

        for (const thread of threads) {
            if (thread.modelName === this.getName()) {
                if (this.isValidDeepseekMetadata(thread.metadata)) {
                    validThreads.push(thread);
                } else {
                    console.warn(`Removing Deepseek thread ${thread.id} due to invalid metadata.`);
                    hasChanges = true;
                }
            } else {
                validThreads.push(thread);
            }
        }

        if (hasChanges) {
            await this.saveThreadsToStorage(validThreads);
            console.log('Removed threads with invalid metadata.');
        }
    }

    /**
     * Type guard to check if metadata is valid for DeepSeek.
     */
    private isValidDeepseekMetadata(metadata: any): metadata is DeepseekThreadMetadata {
        return typeof metadata?.conversationId === 'string' && metadata.conversationId.length > 0;
    }

    /**
     * Retrieves valid DeepSeek metadata from the current thread, throws if invalid.
     */
    private getDeepseekMetadata(): DeepseekThreadMetadata {
        const currentThread = this.getCurrentThreadSafe();
        // if (!currentThread) { // Should ideally be caught by getCurrentThreadSafe, but belt-and-suspenders
        //     return this.handleModelError('Cannot get metadata: No current thread available.', ErrorCode.INVALID_REQUEST);
        // }

        if (!currentThread.metadata || !this.isValidDeepseekMetadata(currentThread.metadata)) {
            // console.error('Invalid or missing Deepseek metadata for current thread:', currentThread.id, currentThread.metadata); // Logging handled by handleModelError
            return this.handleModelError('Invalid or missing Deepseek thread metadata.', ErrorCode.INVALID_METADATA);
        }
        return currentThread.metadata as DeepseekThreadMetadata;
    }

    // --- Initialization & Thread Management ---

    /**
     * Ensures a thread is loaded, fetching the most recent or creating a new one.
     */
    private async ensureThreadLoaded(): Promise<void> {
        if (!this.currentThread) {
            const threads = await this.getAllThreads();
            const deepseekThreads = threads.filter(t =>
                t.modelName === this.getName() && this.isValidDeepseekMetadata(t.metadata)
            );
            if (deepseekThreads.length > 0) {
                const mostRecentThread = deepseekThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                this.currentThread = mostRecentThread;
                console.log('Loaded existing DeepSeek thread from storage:', this.currentThread.id);
            } else {
                await this.initNewThread();
            }
        }
    }

    /**
     * Gets the current thread or throws an error if none exists.
     */
    private getCurrentThreadSafe(): NonNullable<typeof this.currentThread> {
        if (!this.currentThread) {
            return this.handleModelError('No active thread', ErrorCode.INVALID_REQUEST);
        }
        return this.currentThread;
    }

    // --- Model Information ---

    getName(): string {
        return 'DeepSeek Web';
    }

    supportsImageInput(): boolean {
        return false;
    }

    // private async getCfClearanceCookie(): Promise<string | undefined> {
    //     const cookie = await Browser.cookies.get({
    //         url: "https://chat.deepseek.com",
    //         name: "cf_clearance"
    //     });
    //     console.log(`[getCfClearanceCookie] Cookie value: ${cookie?.value}`);
    //     return cookie?.value;
    // }

    // --- API Interaction ---

    /**
     * Creates standard headers for DeepSeek API requests.
     */
    // private async getHeaders(includeAuth = true): Promise<Record<string, string>> {
    //     const headers: Record<string, string> = {
    //         'Accept': '*/*',
    //         'Accept-Encoding': 'gzip, deflate, br, zstd',
    //         'Accept-Language': 'en-US,en-GB;q=0.9,en;q=0.8',
    //         'Cache-Control': 'no-cache',
    //         'Content-Type': 'application/json',
    //         'DNT': '1',
    //         'Origin': 'https://chat.deepseek.com',
    //         'Pragma': 'no-cache',
    //         'Priority': 'u=1, i',
    //         'Referer': 'https://chat.deepseek.com/',
    //         'Sec-CH-UA': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    //         'Sec-CH-UA-Arch': '"x86"',
    //         'Sec-CH-UA-Bitness': '"64"',
    //         'Sec-CH-UA-Full-Version': '"135.0.7049.116"',
    //         'Sec-CH-UA-Full-Version-List': '"Google Chrome";v="135.0.7049.116", "Not-A.Brand";v="8.0.0.0", "Chromium";v="135.0.7049.116"',
    //         'Sec-CH-UA-Mobile': '?0',
    //         'Sec-CH-UA-Model': '""',
    //         'Sec-CH-UA-Platform': '"Windows"',
    //         'Sec-CH-UA-Platform-Version': '"19.0.0"',
    //         'Sec-Fetch-Dest': 'empty',
    //         'Sec-Fetch-Mode': 'cors',
    //         'Sec-Fetch-Site': 'same-origin',
    //         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    //         'X-App-Version': '20241129.1',
    //         'X-Client-Locale': 'en_US',
    //         'X-Client-Platform': 'web',
    //         'X-Client-Version': '1.1.0-new-sse',
    //     };
    //     if (includeAuth) {
    //         if (!this.authToken) {
    //             return this.handleModelError('Authentication token is missing when creating headers.', ErrorCode.UNAUTHORIZED);
    //         }
    //         headers['Authorization'] = this.authToken!;
    //     }
    //     // const cfClearance = await this.getCfClearanceCookie();
    //     // if (cfClearance) {
    //     //     headers['Cookie'] = `cf_clearance=${cfClearance}`;
    //     // }
    //     return headers;
    // }
    // private async getCfClearanceCookie(): Promise<string | undefined> {
    //     const cookie = await Browser.cookies.get({
    //         url: "https://chat.deepseek.com",
    //         name: "cf_clearance"
    //     });
    //     console.log(`[getCfClearanceCookie] Cookie value: ${cookie?.value}`);
    //     return cookie?.value;
    // }

    // --- API Interaction ---

    /**
     * Creates standard headers for DeepSeek API requests.
     */
    // private async getHeaders(includeAuth = true): Promise<Record<string, string>> {
    //     const headers: Record<string, string> = {
    //         'Accept': '*/*',
    //         'Accept-Encoding': 'gzip, deflate, br, zstd',
    //         'Accept-Language': 'en-US,en-GB;q=0.9,en;q=0.8',
    //         'Cache-Control': 'no-cache',
    //         'Content-Type': 'application/json',
    //         'DNT': '1',
    //         'Origin': 'https://chat.deepseek.com',
    //         'Pragma': 'no-cache',
    //         'Priority': 'u=1, i',
    //         'Referer': 'https://chat.deepseek.com/',
    //         'Sec-CH-UA': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    //         'Sec-CH-UA-Arch': '"x86"',
    //         'Sec-CH-UA-Bitness': '"64"',
    //         'Sec-CH-UA-Full-Version': '"135.0.7049.116"',
    //         'Sec-CH-UA-Full-Version-List': '"Google Chrome";v="135.0.7049.116", "Not-A.Brand";v="8.0.0.0", "Chromium";v="135.0.7049.116"',
    //         'Sec-CH-UA-Mobile': '?0',
    //         'Sec-CH-UA-Model': '""',
    //         'Sec-CH-UA-Platform': '"Windows"',
    //         'Sec-CH-UA-Platform-Version': '"19.0.0"',
    //         'Sec-Fetch-Dest': 'empty',
    //         'Sec-Fetch-Mode': 'cors',
    //         'Sec-Fetch-Site': 'same-origin',
    //         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    //         'X-App-Version': '20241129.1',
    //         'X-Client-Locale': 'en_US',
    //         'X-Client-Platform': 'web',
    //         'X-Client-Version': '1.1.0-new-sse',
    //     };
    //     if (includeAuth) {
    //         if (!this.authToken) {
    //             return this.handleModelError('Authentication token is missing when creating headers.', ErrorCode.UNAUTHORIZED);
    //         }
    //         headers['Authorization'] = this.authToken!;
    //     }
    //     // const cfClearance = await this.getCfClearanceCookie();
    //     // if (cfClearance) {
    //     //     headers['Cookie'] = `cf_clearance=${cfClearance}`;
    //     // }
    //     return headers;
    // }
    private async getHeaders(includeAuth = true): Promise<Record<string, string>> {
        // Get platform info from the extension API
        let headers: Record<string, string> = {};
        let arch = "x86";
        let os = "Windows";
        let bitness = "64";
        try {
            const platformInfo = await Browser.runtime.getPlatformInfo();
            arch = platformInfo.arch || arch;
            os = platformInfo.os === "win" ? "Windows" : platformInfo.os;
            bitness = platformInfo.arch === "x86-64" ? "64" : "32";
        } catch (e) {
            // fallback to defaults
        }

        try {
            // Use navigator for UA and language
            const userAgent = navigator.userAgent;
            const language = navigator.language || "en-US";
            const languages = navigator.languages ? navigator.languages.join(",") : language;

            // Compose headers
            headers = {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': languages,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'DNT': '1',
                // 'Origin': 'https://chat.deepseek.com',
                // 'Pragma': 'no-cache',
                // 'Referer': 'https://chat.deepseek.com/',
                'Priority': 'u=1, i',
                'Sec-CH-UA': (typeof (navigator as any).userAgentData !== "undefined" && (navigator as any).userAgentData.brands)
                    ? (navigator as any).userAgentData.brands.map((b: any) => `"${b.brand}";v="${b.version}"`).join(", ")
                    : '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'Sec-CH-UA-Arch': `"${arch}"`,
                'Sec-CH-UA-Bitness': `"${bitness}"`,
                'Sec-CH-UA-Full-Version': (typeof (navigator as any).userAgentData !== "undefined" && (navigator as any).userAgentData.uaFullVersion)
                    ? `"${(navigator as any).userAgentData.uaFullVersion}"`
                    : '"135.0.7049.116"',
                'Sec-CH-UA-Full-Version-List': (typeof (navigator as any).userAgentData !== "undefined" && (navigator as any).userAgentData.brands)
                    ? (navigator as any).userAgentData.brands.map((b: any) => `"${b.brand}";v="${b.version}"`).join(", ")
                    : '"Google Chrome";v="135.0.7049.116", "Not-A.Brand";v="8.0.0.0", "Chromium";v="135.0.7049.116"',
                'Sec-CH-UA-Mobile': (typeof (navigator as any).userAgentData !== "undefined" && (navigator as any).userAgentData.mobile) ? '?1' : '?0',
                'Sec-CH-UA-Model': '""',
                'Sec-CH-UA-Platform': `"${os}"`,
                'Sec-CH-UA-Platform-Version': '"19.0.0"', // Not directly available, keep as fallback
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': userAgent,
                'X-App-Version': `${(await this.getPlatformData())[0]}`,
                'X-Client-Locale': language.replace("-", "_"),
                'X-Client-Platform': 'web',
                'X-Client-Version': '1.1.0-new-sse',
            };

        }
        catch (e) {
            this.handleModelError('Failed to get platform info during header creation', ErrorCode.SERVICE_UNAVAILABLE, undefined, e);
        }



        if (includeAuth) {
            if (!this.authToken) {
                return this.handleModelError('Authentication token is missing when creating headers.', ErrorCode.UNAUTHORIZED);
            }
            headers['Authorization'] = this.authToken!;
        }


        return headers;
    }

    /**
     * Helper to fetch and solve the PoW challenge for /api/v0/chat/completion
     * @serverOperation Interacts with DeepSeek's PoW endpoint.
     */
    private async getPowSolutionForCompletion(targetUrl: string): Promise<string> {
        const powUrl = `${this.DEEPSEEK_HOST}/api/v0/chat/create_pow_challenge`;
        const payload = { target_path: targetUrl || "/api/v0/chat/completion" };
        let challengeObj: any;
        try {
            const response = await this.makeDeepseekRequest(powUrl, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: payload,
                responseType: 'json',
            });
            const data = response._data;
            if (
                data?.code === 0 &&
                data?.data?.biz_code === 0 &&
                data?.data?.biz_data?.challenge
            ) {
                challengeObj = data.data.biz_data.challenge;
            } else {
                // Use handleModelError for consistency
                return this.handleModelError('Invalid PoW challenge response structure.', ErrorCode.RESPONSE_PARSING_ERROR, undefined, data);
            }
        } catch (err) {
            return this.handleModelError('Failed to fetch PoW challenge.', ErrorCode.SERVICE_UNAVAILABLE, undefined, err);
        }
        try {
            const solution = await solveDeepSeekPowWasm(challengeObj);
            return solution;
        } catch (err) {
            return this.handleModelError('Failed to solve PoW challenge.', ErrorCode.POW_CHALLENGE_FAILED, undefined, err);
        }
    }

    /**
    * Wrapper around ofetch to handle DeepSeek specific challenges and errors.
    */
    private async makeDeepseekRequest<T = any>(
        url: string,
        options: FetchOptions,
        retryCount = 1
    ): Promise<FetchResponse<T>> {
        
        try {
            // Always ensure auth token is included for non-public endpoints
            const needsAuth = !options.headers || !(options.headers as Record<string, string>)['Authorization'];
            if (needsAuth) {
                const token = await this.ensureAuthToken();
                options.headers = { ...(options.headers as Record<string, string>), 'Authorization': token };
            }
            // Add common headers if not already set
            const commonHeaders = await this.getHeaders(false);
            options.headers = { ...commonHeaders, ...(options.headers as Record<string, string>) };

            console.debug(`Making Deepseek request: ${options.method || 'GET'} ${url}`);
            const response = await ofetch.raw<T>(url, options as any);
            console.debug(`Deepseek request to ${url} successful.`);
            return response;

        } catch (error) {
            // console.warn(`Deepseek request to ${url} failed initially:`, error); // Logging handled by handleModelError

            // Check for Cloudflare specifically before generic handling
            if (error instanceof FetchError && error.response) {
                const status = error.response.status;
                const responseBodyPromise = error.response.text();
                try {
                    const responseBody = await responseBodyPromise;
                    if (status === 403 && (responseBody.includes('cf-challenge-running') || responseBody.includes('Cloudflare') || responseBody.includes('Checking if the site connection is secure'))) {
                        // console.error('Cloudflare challenge detected. Manual intervention or browser context might be required.'); // Logging handled by handleModelError
                        return this.handleModelError(
                            'Cloudflare challenge detected. Please ensure you can access https://chat.deepseek.com in your browser.',
                            ErrorCode.NETWORK_ERROR, undefined, error
                        );
                    }
                } catch (bodyError) {
                    // Ignore error reading body, proceed to general error handling
                    console.warn(`Error reading response body for ${url} after initial failure:`, bodyError);
                }
            }

            // Use handleModelError for all other errors
            return this.handleModelError(`Deepseek API request to ${url} failed`, ErrorCode.NETWORK_ERROR, undefined, error);
        }
    }

    /**
     * Fetches current user information.
     * @serverOperation Interacts with DeepSeek's session fetching endpoint.
     */
    @serverOperation
    async getUserInfo(): Promise<any> {
        const url = `${this.DEEPSEEK_HOST}/api/v0/users/current`;
        try {
            const response = await this.makeDeepseekRequest(url, {
                method: 'GET',
            });
            return response._data;
        } catch (error) {
            // console.error('getUserInfo failed:', error); // Logging handled by handleModelError
            return this.handleModelError('Failed to get user info', ErrorCode.NETWORK_ERROR, undefined, error);
        }
    }

    /**
     * Fetches a page of conversation sessions.
     * @serverOperation Interacts with DeepSeek's session fetching endpoint.
     */
    @serverOperation
    async getAllConversationsData(count: number = 100): Promise<any> {
        const url = `${this.DEEPSEEK_HOST}/api/v0/chat_session/fetch_page?count=${count}`;
        try {
            const response = await this.makeDeepseekRequest(url, {
                method: 'GET',
            });
            if (response._data?.code === 0 && response._data?.data?.biz_code === 0 && response._data?.data?.biz_data?.chat_sessions) {
                return response._data;
            } else {
                // console.error('Invalid format received from getAllConversationsData:', response._data); // Logging handled by handleModelError
                const errorMsg = response._data?.msg || response._data?.data?.biz_msg || 'Unknown error fetching conversations';
                return this.handleModelError(`API returned unexpected structure or error: ${errorMsg}`, ErrorCode.RESPONSE_PARSING_ERROR, undefined, response._data);
            }
        } catch (error) {
            return this.handleModelError('Failed to get conversations data', ErrorCode.NETWORK_ERROR, undefined, error);
        }
    }

    /**
     * Fetches platform version and status information.
     * @serverOperation Interacts with DeepSeek's version/status endpoints.
     */
    @serverOperation
    async getPlatformData(): Promise<[string | null, any | null]> {
        let version: string | null = null;
        let status: any | null = null;

        const versionUrl = `${this.DEEPSEEK_HOST}/version.txt`;
        const statusUrl = `${this.DEEPSEEK_HOST}/downloads/status.json`;

        try {
            const versionResp = await fetch(versionUrl, { method: 'GET' });
            if (versionResp.ok) {
                version = await versionResp.text();
            } else {
                console.warn('Failed to fetch DeepSeek version:', versionResp.status);
            }
        } catch (err) {
            console.warn('Failed to fetch DeepSeek version:', err);
        }

        try {
            const statusResp = await fetch(statusUrl, { method: 'GET' });
            if (statusResp.ok) {
                status = await statusResp.json();
            } else {
                console.warn('Failed to fetch DeepSeek status:', statusResp.status);
            }
        } catch (err) {
            console.warn('Failed to fetch DeepSeek status:', err);
        }

        return [version, status];
    }

    /**
     * Creates a new conversation session on the server. 
     */
    private async createConversation(): Promise<string> {
        console.log('Crefrerefefr..');
        const url = `${this.DEEPSEEK_HOST}/api/v0/chat_session/create`;
        try {
            const response = await this.makeDeepseekRequest<{ code: number, msg: string, data: { biz_code: number, biz_msg: string, biz_data: { id: string } } }>(url, {
                method: 'POST',
                body: { character_id: null },
            });

            const responseData = response._data;
            if (responseData?.code === 0 && responseData.data?.biz_code === 0 && responseData.data?.biz_data?.id) {
                console.log(`Created new Deepseek conversation: ${responseData.data.biz_data.id}`);
                return responseData.data.biz_data.id;
            } else {
                const errorMsg = responseData?.msg || responseData?.data?.biz_msg || 'Unknown error creating conversation';
                return this.handleModelError(`Failed to create DeepSeek conversation: ${errorMsg}`, ErrorCode.SERVICE_UNAVAILABLE, undefined, responseData);
            }
        } catch (error) {
            return this.handleModelError('Failed to create conversation', ErrorCode.SERVICE_UNAVAILABLE, undefined, error);
        }
    }

    // --- Thread Management ---

    /**
     * Initializes a new local and server-side conversation thread.
     */
    async initNewThread(): Promise<void> {
        console.log('ffffffffffffff..');
        try {
            await this.ensureAuthToken();
            const conversationId = await this.createConversation();
            console.log(`Created new Deepseek conversation: ${conversationId}`);

            this.currentThread = {
                id: conversationId,
                title: 'New DeepSeek Chat',
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                modelName: this.getName(),
                metadata: {
                    conversationId: conversationId,
                    lastMessageId: null
                } as DeepseekThreadMetadata
            };

            await this.saveThread();
            console.log(`Initialized and saved new DeepSeek thread: ${this.currentThread.id} (Conv ID: ${conversationId})`);

        } catch (error) {
            return this.handleModelError('Failed to initialize new thread', ErrorCode.METADATA_INITIALIZATION_ERROR, undefined, error);
        }
    }

    // --- Message Sending ---

    /**
     * Implements the core logic for sending a message and processing the response stream.
     * Uses the same event and error handling conventions as Claude/Gemini.
     */
    protected async doSendMessage(params: {
        prompt: string;
        images?: File[] | undefined;
        signal?: AbortSignal | undefined;
        mode?: string;
        searchEnabled?: boolean;
        onEvent: (event: StatusEvent) => void;
    }): Promise<void> {
        // --- File upload support ---
        let refFileIds: string[] = [];
        if (params.images && params.images.length > 0) {
            // Only allow up to 4 files for safety (Deepseek may have limits)
            if (params.images.length > 4) {
                return this.handleModelError('A maximum of 4 files can be uploaded at once.', ErrorCode.UPLOAD_AMOUNT_EXCEEDED, params);
            }
            for (const file of params.images) {
                try {
                    const fileId = await this.uploadFile(file);
                    refFileIds.push(fileId);
                } catch (err) {
                    // uploadFile already calls handleModelError, so just return
                    return;
                }
            }
        }
        let currentThread: ChatThread;
        try {
            params.onEvent({ type: 'UPDATE_ANSWER', data: { text: '' } });
            await this.ensureThreadLoaded();
            currentThread = this.getCurrentThreadSafe();
            const metadata = this.getDeepseekMetadata();
            const userMessage = this.createMessage('user', params.prompt);
            // Optionally store file info in user message metadata
            if (refFileIds.length > 0) {
                userMessage.metadata = { ...(userMessage.metadata || {}), uploadedFileIds: refFileIds };
            }
            currentThread.messages.push(userMessage);
            currentThread.updatedAt = Date.now();
            await this.saveThread();
            const powSolution = await this.getPowSolutionForCompletion("/api/v0/chat/completion");
            const payload = {
                chat_session_id: metadata.conversationId,
                parent_message_id: metadata.lastMessageId || null,
                prompt: params.prompt,
                ref_file_ids: refFileIds,
                thinking_enabled: params.mode === 'reasoning' ? true : false,
                search_enabled: params.searchEnabled === true, // default to false if not set
            };


            // Fail early if both attachments and search are attempted.
            if (payload.search_enabled && refFileIds.length > 0) {
                return this.handleModelError(
                    'search mode and files attachments can not be used together',
                    ErrorCode.INVALID_REQUEST,
                    params
                );
            }


            const url = `${this.DEEPSEEK_HOST}/api/v0/chat/completion`;
            const streamResponse = await this.makeDeepseekRequest(url, {
                method: 'POST',
                headers: {
                    ...(await this.getHeaders()),
                    'Accept': '*/*',
                    'x-ds-pow-response': powSolution,
                },
                body: payload,
                responseType: 'stream',
                signal: params.signal,
            });
            if (!streamResponse.body) {
                return this.handleModelError('No response body received in stream.', ErrorCode.NETWORK_ERROR, params);
            }
            // --- Stream Processing ---
            const reader = streamResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // Parsed response accumulator, enhanced for clarity
            const parsed: ParsedModelResponse = {
                text: '',                   // Final assistant message content
                reasoningContent: '',      // Accumulated reasoning/thinking content
                tokensUsed: 0,              // Accumulated token usage
                title: undefined,           // Conversation title update
                updatedAt: undefined,       // Session update timestamp
                // --- Fields extracted from the initial 'response' object ---
                messageId: undefined,       // Deepseek's internal message ID
                parentId: undefined,        // Deepseek's internal parent message ID
                model: undefined,           // Model used (often empty string)
                role: 'ASSISTANT',          // Role (should always be ASSISTANT)
                thinkingEnabled: undefined, // Was reasoning enabled for this request?
                banEdit: undefined,         // Can the message be edited?
                banRegenerate: undefined,   // Can the message be regenerated?
                status: undefined,          // Status (WIP, FINISHED)
                files: [],                  // Associated files
                tips: [],                   // Tips provided by the model
                insertedAt: undefined,      // Timestamp when message was inserted
                searchEnabled: undefined,   // Was search enabled for this request?
                searchStatus: undefined,    // Status of the search process
                searchResults: undefined,   // Results from the search
                // --- Fields specifically for reasoning/thinking process ---
                reasoningElapsedSecs: undefined, // Time spent in reasoning/thinking (from later update)
            };
            let done = false;
            // State to track if we are currently parsing reasoning or content. Crucial for handling pathless APPENDs.
            let parsingTarget: 'reasoning' | 'content' | null = null;

            while (!done) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;
                buffer += decoder.decode(value, { stream: true });
                let eventSeparatorIndex;
                while ((eventSeparatorIndex = buffer.indexOf('\n\n')) !== -1) {
                    const eventBlock = buffer.substring(0, eventSeparatorIndex);
                    buffer = buffer.substring(eventSeparatorIndex + 2);
                    let eventType: string | null = null;
                    let eventData: any = null;
                    const lines = eventBlock.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.substring(7).trim();
                        } else if (line.startsWith('data: ')) {
                            const dataStr = line.substring(5).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                try {
                                    eventData = JSON.parse(dataStr);
                                } catch (e) {
                                    continue;
                                }
                            }
                        }
                    }

                    // --- Parse events/data ---
                    if (eventType === 'title' && eventData?.content) {
                        parsed.title = eventData.content;
                        // Optionally emit a TITLE_UPDATE event
                        params.onEvent({ type: 'TITLE_UPDATE', data: { title: parsed.title || '', threadId: currentThread.id } });
                    } else if (eventType === 'update_session' && eventData?.updated_at) {
                        // Convert to milliseconds if it's in seconds
                        parsed.updatedAt = eventData.updated_at * 1000;
                    } else if (eventType === 'close') {
                        done = true;
                    } else if (eventType === 'ready') {
                        // Ignore 'ready' event
                    } else if (!eventType && eventData?.v && typeof eventData.v === 'object' && eventData.v.response) {
                        // Initial response object event (has no 'event:' line)
                        // Extract relevant fields carefully
                        const resp = eventData.v.response;
                        parsed.messageId = resp.message_id;
                        parsed.parentId = resp.parent_id;
                        parsed.model = resp.model;
                        parsed.role = resp.role;
                        parsed.thinkingEnabled = resp.thinking_enabled;
                        // parsed.thinkingElapsedSecs = resp.thinking_elapsed_secs; // Might be overwritten later
                        parsed.banEdit = resp.ban_edit;
                        parsed.banRegenerate = resp.ban_regenerate;
                        parsed.status = resp.status; // Initial status is WIP
                        parsed.files = resp.files || [];
                        parsed.tips = resp.tips || [];
                        // Convert inserted_at to milliseconds if it's in seconds
                        parsed.insertedAt = resp.inserted_at * 1000;
                        parsed.searchEnabled = resp.search_enabled;
                        parsed.searchStatus = resp.search_status;
                        parsed.searchResults = resp.search_results;
                        parsed.tokensUsed = resp.accumulated_token_usage; // Initial token usage
                        parsed.reasoningContent = resp.thinking_content || ''; // Initial reasoning content
                        parsed.reasoningElapsedSecs = resp.thinking_elapsed_secs || 0; // Initial reasoning time

                    } else if (!eventType && eventData?.v && typeof eventData.v === 'string') {
                        // This block handles all string data chunks, both with and without paths/operations.
                        const path = eventData.p as string | undefined;
                        const value = eventData.v;
                        // Note: Deepseek's pathless chunks are implicit appends. 'o' might not always be present.
                        // const operation = eventData.o as 'APPEND' | 'SET' | undefined;
                        let updated = false;

                        if (path === 'response/thinking_content') {
                            parsingTarget = 'reasoning'; // Set state: now parsing reasoning
                            // This is the first chunk for reasoning, initialize it.
                            parsed.reasoningContent = value;
                            updated = true;
                        } else if (path === 'response/content') {
                            parsingTarget = 'content'; // Set state: now parsing main content
                            // This is the first chunk for content, initialize it.
                            parsed.text = value;
                            updated = true;
                        } else if (!path && value != null) { // Handle pathless chunks (implicit appends)
                            if (parsingTarget === 'reasoning') {
                                // Append to reasoning if that's the established target
                                parsed.reasoningContent += value;
                                updated = true;
                            } else if (parsingTarget === 'content') {
                                // Append to content if that's the established target
                                parsed.text += value;
                                updated = true;
                            } else {
                                // If target is null (should only be the very first text chunk overall)
                                // Determine initial target based on thinkingEnabled
                                if (parsed.thinkingEnabled) {
                                    parsed.reasoningContent += value; // Start accumulating reasoning
                                    parsingTarget = 'reasoning';      // Set initial target
                                    updated = true;
                                } else {
                                    // If thinking is not enabled, the first chunk must be content
                                    parsed.text += value;
                                    parsingTarget = 'content';
                                    updated = true;
                                }
                                // console.warn("First pathless text chunk determined target:", parsingTarget, eventData);
                            }
                        } else if (path && path !== 'response/status') {
                            // Log unexpected string data with other paths
                            console.warn(`Received string data with unhandled path '${path}':`, eventData);
                        }

                        // Emit cumulative update if any text/reasoning changed
                        if (updated) {
                            params.onEvent({
                                type: 'UPDATE_ANSWER',
                                data: {
                                    text: parsed.text,
                                    reasoningContent: parsed.reasoningContent,
                                    reasoningElapsedSecs: parsed.reasoningElapsedSecs,
                                }
                            });
                        }
                    } else if (!eventType && eventData?.v && typeof eventData.v === 'number') {
                        // Handle numeric value updates based on path
                        const path = eventData.p;
                        const value = eventData.v;
                        if (path === 'response/accumulated_token_usage') {
                            parsed.tokensUsed = value;
                        } else if (path === 'response/thinking_elapsed_secs') {
                            // Use the final value for reasoning time
                            parsed.reasoningElapsedSecs = value;
                            params.onEvent({
                                type: 'UPDATE_ANSWER',
                                data: {
                                    text: parsed.text,
                                    reasoningContent: parsed.reasoningContent,
                                    reasoningElapsedSecs: parsed.reasoningElapsedSecs,
                                }
                            });
                        }
                    } else if (!eventType && eventData?.v && typeof eventData.v === 'string' && eventData.p === 'response/status') {
                        // Handle status updates
                        parsed.status = eventData.v; // e.g., "FINISHED"
                        if (parsed.status === 'FINISHED') {
                            // Potentially do final cleanup or checks here
                        }
                    }
                }
            }
            // --- End Stream Processing ---

            // --- End Stream Processing ---

            // Update thread with assistant's response
            const assistantMessage = this.createMessage('assistant', parsed.text);

            // Add reasoning content directly if it exists
            if (parsed.reasoningContent && parsed.reasoningContent.trim()) {
                assistantMessage.reasoningContent = parsed.reasoningContent.trim();
            }

            // Populate metadata with parsed fields, avoiding redundancy with top-level fields
            assistantMessage.metadata = {
                ...(assistantMessage.metadata || {}), // Preserve any existing metadata
                responseTokens: parsed.tokensUsed,
                serverMessageId: parsed.messageId, // Use a distinct key for Deepseek's ID
                serverParentId: parsed.parentId,
                modelUsed: parsed.model,
                finalStatus: parsed.status,
                reasoningTimeSecs: parsed.reasoningElapsedSecs,
                serverInsertedAt: parsed.insertedAt, // Keep original timestamp if needed
                thinkingEnabled: parsed.thinkingEnabled,
                searchEnabled: parsed.searchEnabled,
                searchStatus: parsed.searchStatus,
                searchResults: parsed.searchResults,
                banEdit: parsed.banEdit,
                banRegenerate: parsed.banRegenerate,
                files: parsed.files,
                tips: parsed.tips,
                // Add any other specific fields from 'parsed' that aren't top-level ChatMessage fields
            };

            // Clean up metadata: remove undefined fields for tidiness
            Object.keys(assistantMessage.metadata).forEach(key => {
                if (assistantMessage.metadata![key] === undefined) {
                    delete assistantMessage.metadata![key];
                }
            });

            currentThread.messages.push(assistantMessage);
            // Update the lastMessageId in the thread's metadata
            if (assistantMessage.metadata?.serverMessageId) {
                if (!currentThread.metadata) {
                    currentThread.metadata = { conversationId: this.getDeepseekMetadata().conversationId }; // Ensure metadata object exists
                }
                (currentThread.metadata as DeepseekThreadMetadata).lastMessageId = assistantMessage.metadata.serverMessageId;
            }
            if (parsed.title) currentThread.title = parsed.title;
            if (parsed.updatedAt) currentThread.updatedAt = parsed.updatedAt;
            else currentThread.updatedAt = Date.now(); // Fallback timestamp if not provided
            await this.saveThread();

            params.onEvent({
                type: 'DONE',
                data: {
                    threadId: currentThread.id
                }
            });
        } catch (error) {
            this.handleModelError(
                'Error during message sending or processing',
                error instanceof AIModelError ? error.code : ErrorCode.NETWORK_ERROR,
                params,
                error
            );
        }
    }

    /**
     * Updates the title of a DeepSeek conversation.
     * @param newTitle The new title to set for the conversation
     * @param options Optional config: loadThread (default true), metadata (optional), tryUpdateThread (default true)
     * @serverOperation This method makes direct API calls to DeepSeek's servers
     */
    @serverOperation
    async editTitle(
        newTitle: string,
        options?: {
            loadThread?: boolean;
            metadata?: DeepseekThreadMetadata;
            tryUpdateThread?: boolean;
        }
    ): Promise<void> {
        try {
            let shouldLoadThread = options?.loadThread !== false;
            let tryUpdateThread = options?.tryUpdateThread !== false;
            let metadata: DeepseekThreadMetadata;

            if (shouldLoadThread) {
                await this.ensureThreadLoaded();
                metadata = this.getDeepseekMetadata();
            } else if (options?.metadata) {
                metadata = options.metadata;
                if (!this.isValidDeepseekMetadata(metadata)) {
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

            const chatSessionId = metadata.conversationId;
            if (!chatSessionId) {
                return this.handleModelError(
                    'Missing chat_session_id for title update',
                    ErrorCode.INVALID_REQUEST
                );
            }

            const url = `${this.DEEPSEEK_HOST}/api/v0/chat_session/update_title`;
            const payload = {
                chat_session_id: chatSessionId,
                title: newTitle
            };

            const response = await this.makeDeepseekRequest(url, {
                method: 'POST',
                headers: await this.getHeaders(), // Auth header, no PoW needed
                body: payload,
                responseType: 'json'
            });

            const data = response._data;
            if (data?.code === 0 && data?.data?.biz_code === 0) {
                // Update local thread title if requested
                if (tryUpdateThread && this.currentThread) {
                    this.currentThread.title = newTitle;
                    await this.saveThread();
                }
            } else {
                const errorMsg = data?.msg || data?.data?.biz_msg || 'Unknown error updating title';
                return this.handleModelError(
                    `Failed to update DeepSeek conversation title: ${errorMsg}`,
                    ErrorCode.SERVICE_UNAVAILABLE,
                    undefined,
                    data
                );
            }
        } catch (error) {
            return this.handleModelError(
                'Error updating DeepSeek conversation title',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }

    /**
     * Deletes one or more conversations from DeepSeek's servers.
     * @param threadIds Array of thread IDs (local thread IDs, not chat_session_id)
     * @param updateLocalThread If true, also delete the thread from local storage upon successful server deletion.
     * @param createNewThreadAfterDelete If true and the currently active thread is deleted locally, initialize a new thread.
     * @serverOperation This method makes direct API calls to DeepSeek's servers.
     */
    @serverOperation
    async deleteServerThreads(
        threadIds: string[],
        updateLocalThread: boolean = true,
        createNewThreadAfterDelete: boolean = true
    ): Promise<void> {
        try {
            const allThreads = await this.getAllThreads();

            for (const threadId of threadIds) {
                const thread = allThreads.find(t => t.metadata && t.metadata.conversationId === threadId);

                if (!thread) {
                    console.warn(`[deleteServerThreads] Thread ${threadId} not found locally.`);
                    continue;
                }

                if (thread.modelName !== this.getName()) {
                    console.warn(`[deleteServerThreads] Thread ${threadId} has incorrect model name: ${thread.modelName}. Skipping.`);
                    continue;
                }

                if (!this.isValidDeepseekMetadata(thread.metadata)) {
                    if (updateLocalThread) {
                        console.warn(`[deleteServerThreads] Thread ${threadId} has invalid or missing metadata. Cannot delete from server, deleting locally only.`);
                        await this.deleteThread(thread.id, createNewThreadAfterDelete);
                    }
                    else {
                        console.warn(`[deleteServerThreads] Thread ${threadId} has invalid or missing metadata. Cannot delete from server, skipping thread.`);
                    }
                    continue;
                }

                const chatSessionId = thread.metadata.conversationId;

                // --- Proceed with server deletion ---
                const url = `${this.DEEPSEEK_HOST}/api/v0/chat_session/delete`;
                const payload = { chat_session_id: chatSessionId };

                const response = await this.makeDeepseekRequest(url, {
                    method: 'POST',
                    headers: await this.getHeaders(),
                    body: payload,
                    responseType: 'json'
                });

                const data = response._data;
                if (data?.code === 0 && data?.data?.biz_code === 0) {
                    console.log(`[deleteServerThreads] Successfully deleted DeepSeek conversation: ${chatSessionId} from server.`);
                    // Local Deletion (if requested)
                    if (updateLocalThread) {
                        await this.deleteThread(thread.id, createNewThreadAfterDelete);
                    }
                } else {
                    const errorMsg = data?.msg || data?.data?.biz_msg || 'Unknown error deleting conversation';
                    return this.handleModelError(
                        `Failed to delete DeepSeek conversation: ${errorMsg}`,
                        ErrorCode.SERVICE_UNAVAILABLE,
                        undefined,
                        data
                    );
                }
            }
        } catch (error) {
            return this.handleModelError(
                'Error deleting DeepSeek conversation(s)',
                ErrorCode.SERVICE_UNAVAILABLE,
                undefined,
                error
            );
        }
    }

    /**
     * Uploads a file to Deepseek (supports images and certain file types).
     * If the file is an image, only extracted text is used; if no text, returns error.
     * Returns the file id if successful and usable, or throws on error/unsupported.
     */
    async uploadFile(file: File): Promise<string> {
        await this.ensureAuthToken();
        // Solve PoW for file upload endpoint
        const powSolution = await this.getPowSolutionForCompletion("/api/v0/file/upload_file");
        const url = `${this.DEEPSEEK_HOST}/api/v0/file/upload_file`;
        const formData = new FormData();
        formData.append('file', file);
        // Use fetch directly for FormData (ofetch doesn't handle it well)
        const headers: Record<string, string> = {};
        if (this.authToken) headers['Authorization'] = this.authToken;
        headers['x-ds-pow-response'] = powSolution;
        let resp: any;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include',
            });
            resp = await response.json();
        } catch (err) {
            return this.handleModelError('Failed to upload file to Deepseek', ErrorCode.UPLOAD_FAILED, undefined, err);
        }
        // Check for API-level errors
        if (resp.code !== 0 || resp.data?.biz_code !== 0) {
            const msg = resp.data?.biz_msg || resp.msg || 'Unknown error uploading file';
            return this.handleModelError(`Deepseek file upload failed: ${msg}`, ErrorCode.UPLOAD_FAILED, undefined, resp);
        }
        let fileData = resp.data?.biz_data;
        if (!fileData || !fileData.id) {
            return this.handleModelError('Deepseek file upload: missing file id in response', ErrorCode.UPLOAD_FAILED, undefined, resp);
        }
        // If status is PENDING, poll until processed or failed
        if (fileData.status === 'PENDING' || fileData.status === 'PARSING') {
            fileData = await this.pollFileStatus(fileData.id);
        }
        // If image and content empty, error
        if (fileData.status === 'CONTENT_EMPTY') {
            return this.handleModelError('No text could be extracted from the image.', ErrorCode.UPLOAD_FAILED, undefined, fileData);
        } else if (fileData.status === 'UNSUPPORTED') {
            return this.handleModelError('File type not supported for Deepseek', ErrorCode.UPLOAD_FAILED, undefined, fileData);
        } else if (fileData.status !== 'SUCCESS') {
            return this.handleModelError(`File upload failed or not supported (status: ${fileData.status})`, ErrorCode.UPLOAD_FAILED, undefined, fileData);
        }
        return fileData.id;
    }

    /**
     * Polls Deepseek for file processing status until terminal state.
     */
    private async pollFileStatus(fileId: string, maxTries = 10, delayMs = 1500): Promise<any> {
        const url = `${this.DEEPSEEK_HOST}/api/v0/file/fetch_files?file_ids=${encodeURIComponent(fileId)}`;
        for (let i = 0; i < maxTries; ++i) {
            await new Promise(res => setTimeout(res, delayMs));
            let resp: any;
            try {
                const response = await fetch(url, { method: 'GET', credentials: 'include', headers: this.authToken ? { 'Authorization': this.authToken } : {} });
                resp = await response.json();
            } catch (err) {
                continue;
            }
            if (resp.code === 0 && resp.data?.biz_code === 0 && resp.data?.biz_data?.files?.[0]) {
                const file = resp.data.biz_data.files[0];
                if (['SUCCESS', 'CONTENT_EMPTY', 'FAILED', 'UNSUPPORTED'].includes(file.status)) {
                    return file;
                }
            }
        }
        return this.handleModelError('File processing timed out on Deepseek', ErrorCode.UPLOAD_FAILED);
    }
}