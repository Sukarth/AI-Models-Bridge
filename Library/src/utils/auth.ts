/**
 * Utility functions for handling cookies and authentication
 */
import browser from 'webextension-polyfill';

// Define custom event types for auth state changes
export const AUTH_EVENTS = {
  TOKEN_REFRESH_START: 'token_refresh_start',
  TOKEN_REFRESH_COMPLETE: 'token_refresh_complete',
  TOKEN_REFRESH_ERROR: 'token_refresh_error'
};

// Cache for storing tokens and cookies
interface AuthCache {
  token: string | null;
  cookies: Record<string, string>;
  timestamp: number;
  expiresAt: number; // If token expiry is known, otherwise relies on cacheDurationMs
}

const AUTH_CACHE: Record<string, AuthCache> = {}; // In-memory cache (cleared on extension reload)
const TOKEN_CACHE_PREFIX = 'auth_token_cache_'; // Define cache prefix at module scope
// Note: Using chrome.storage.local for persistent caching below

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh token 5 minutes before expiry (if expiry known)

// Add notification preferences
let shouldNotifyTokenRefresh = true;

export async function requestHostPermission(host: string) {
  const permissions: browser.Permissions.Permissions = { origins: [host] };

  try {
    const hasPermissions = await browser.permissions.contains(permissions);
    if (hasPermissions) return true;
    // Only request if not already granted
    console.log(`Requesting host permission for: ${host}`);
    return await browser.permissions.request(permissions);
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}

/**
 * Configure authentication notification preferences
 * @param options Configuration options
 */
export function configureAuth(options: { notifyTokenRefresh?: boolean }) {
  if (options.notifyTokenRefresh !== undefined) {
    shouldNotifyTokenRefresh = options.notifyTokenRefresh;
  }
}

// Helper function to dispatch auth events (modified)
function dispatchAuthEvent(eventName: string, detail: any = {}) {
  // Only dispatch events if notifications are enabled
  if (shouldNotifyTokenRefresh) {
    const event = new CustomEvent(eventName, {
      detail: { ...detail, timestamp: Date.now() },
      bubbles: true
    });
    document.dispatchEvent(event);
  }
}


/**
 * Get all cookies for a specific domain
 */
export async function getCookiesForDomain(domain: string): Promise<Record<string, string>> {
  try {
    const cookies = await browser.cookies.getAll({ domain });
    const cookieObj: Record<string, string> = {};

    for (const cookie of cookies) {
      cookieObj[cookie.name] = cookie.value;
    }

    return cookieObj;
  } catch (error) {
    console.error(`Error getting cookies for ${domain}:`, error);
    return {};
  }
}

/**
 * Clear the auth cache for a specific service or all services
 * Note: This clears the chrome.storage cache used by getTokenFromWebsite
 */
export async function clearAuthCache(serviceName?: string): Promise<void> {
    const cacheKey = serviceName ? `${TOKEN_CACHE_PREFIX}${serviceName}` : null;
    try {
        if (cacheKey) {
            await browser.storage.local.remove(cacheKey);
            console.log(`[${serviceName} Auth] Cache cleared.`);
        } else {
            // Clear all token caches (more complex, might need to list keys)
            const allStorage = await browser.storage.local.get(null);
            const keysToRemove = Object.keys(allStorage).filter(k => k.startsWith(TOKEN_CACHE_PREFIX));
            if (keysToRemove.length > 0) {
                 await browser.storage.local.remove(keysToRemove);
                 console.log('[Auth] All token caches cleared.');
            }
        }
    } catch (error) {
         console.warn(`[Auth] Error clearing cache for ${serviceName || 'all'}:`, error);
    }
}

// Note: isTokenExpiringSoon and getTokenExpiryTime relied on an in-memory AUTH_CACHE
// which is less useful now with chrome.storage.local caching.
// These might need removal or adaptation if expiry checking is required based on stored timestamp.

// --- Extractor Functions ---

/**
 * Function to inject into a DeepSeek tab to extract the token.
 */
export function deepseekExtractor(): string | null {
    try {
        const storedData = localStorage.getItem('userToken'); // Deepseek key
        if (storedData) {
            const parsedData = JSON.parse(storedData);
            if (parsedData?.value && typeof(parsedData.value) === 'string' && parsedData.value.length > 0 ) {
                return parsedData.value;
            }
            console.warn("Deepseek 'userToken' found but userToken structure not matched:", parsedData);
        } else {
            console.warn("Deepseek 'userToken' key not found in localStorage.");
        }
    } catch (e) {
        console.error('Error executing injected DeepSeek token extractor:', e);
    }
    return null;
}

/**
 * Function to inject into a Copilot tab to extract the token.
 */
export function copilotExtractor(): string | null {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            try {
                const key = localStorage.key(i);
                if (!key) continue;
                const item = JSON.parse(localStorage.getItem(key) || '');
                if (item && item.credentialType === "AccessToken" &&
                    item.expiresOn > Math.floor(Date.now() / 1000) &&
                    item.target?.includes("ChatAI")) {
                    return item.secret; // Return only the token string
                }
            } catch (e) { /* Ignore */ }
        }
    } catch (e) {
        console.error('Error executing injected Copilot token extractor:', e);
    }
    return null;
}

// Add other extractor functions here if needed...


// --- Internal Logic (Not Exported - Called by Background Script) ---

/**
 * Internal logic containing the core steps for token retrieval (tabs, temp window).
 * Should only be called from a context where browser APIs are available (e.g., background script).
 */
export async function executeTokenRetrievalLogic( // Renamed slightly to emphasize internal use
    serviceName: string,
    targetUrl: string,
    urlPattern: string,
    extractorFunc: () => string | null, // The actual function
    forceNewTab: boolean // If true, skip existing tab check
): Promise<string | null> {
    let token: string | null = null;
    console.log(`[${serviceName} Auth Internal] Attempting to retrieve token...`);

    // Ensure browser APIs are available
    if (typeof browser === 'undefined' || !browser.tabs || !browser.scripting || !browser.permissions) {
        console.error(`[${serviceName} Auth Internal] Browser extension APIs (tabs, scripting, permissions) not available.`);
        return null;
    }

     // --- Permission Check ---
     // Assumes permissions were checked/requested by the caller if needed,
     // but a check here adds safety.
     let hasPermissions = false;
     try {
         hasPermissions = await browser.permissions.contains({ origins: [urlPattern] });
     } catch (permError) {
         console.error(`[${serviceName} Auth Internal] Error checking permissions for ${urlPattern}:`, permError);
         return null; // Cannot proceed without permission check
     }

     if (!hasPermissions) {
         console.warn(`[${serviceName} Auth Internal] Missing host permissions for ${urlPattern}. Cannot inject scripts or open tabs.`);
         // Do not request permissions here; should be handled proactively by caller/UI
         return null; // Cannot proceed
     }
     // --- End Permission Check ---


    // 1. Try injecting into existing tabs (unless forcing new tab)
    if (!forceNewTab) {
        try {
            const existingTabs = await browser.tabs.query({ url: urlPattern });
            console.log(`[${serviceName} Auth Internal] Found ${existingTabs.length} potential tabs matching ${urlPattern}.`);

            for (const tab of existingTabs) {
                 if (tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('about:')) { // Avoid injecting into restricted pages
                    console.log(`[${serviceName} Auth Internal] Attempting to inject script into tab ID: ${tab.id} (URL: ${tab.url})`);
                    try {
                        const results = await browser.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: extractorFunc, // Use the passed function
                            world: 'MAIN' as any // <<< Add world: 'MAIN' and type assertion
                        });

                        if (results && results[0] && results[0].result) {
                            token = results[0].result;
                            console.log(`[${serviceName} Auth Internal] Successfully extracted token from existing tab: ${tab.id}`);
                            break; // Token found, exit loop
                        } else {
                            console.log(`[${serviceName} Auth Internal] Script executed on tab ${tab.id}, but no token found in result.`, results);
                        }
                    } catch (injectError) {
                         // Log specific errors like missing permissions or page load issues
                         if (injectError instanceof Error && injectError.message.includes("No window matching")) {
                              console.warn(`[${serviceName} Auth Internal] Could not inject into tab ${tab.id} (window likely closed).`);
                         } else if (injectError instanceof Error && injectError.message.includes("Could not establish connection")) {
                              console.warn(`[${serviceName} Auth Internal] Connection error injecting into tab ${tab.id} (possibly devtools?).`);
                         } else if (injectError instanceof Error && injectError.message.includes("Cannot access contents of the page")) {
                             console.warn(`[${serviceName} Auth Internal] Cannot access contents of tab ${tab.id} (URL: ${tab.url}). Might be restricted page.`);
                         } else {
                              console.warn(`[${serviceName} Auth Internal] Failed to inject script or extract token from tab ${tab.id}:`, injectError);
                         }
                         // Continue to the next tab
                    }
                } else {
                     console.log(`[${serviceName} Auth Internal] Skipping tab ID: ${tab.id} (missing ID or restricted URL: ${tab.url})`);
                }
            }
        } catch (queryError) {
            console.error(`[${serviceName} Auth Internal] Error querying for tabs matching ${urlPattern}:`, queryError);
        }
    } else {
         console.log(`[${serviceName} Auth Internal] Skipping existing tab check because forceNewTab is true.`);
    }

    // 2. Fallback: Open a temporary window if no token found yet
    // This part WILL still close the popup when executed from the popup context.
    if (!token) {
        console.log(`[${serviceName} Auth Internal] No token from existing tabs. Proceeding with temporary window method...`);

        if (!browser.windows) {
            console.error(`[${serviceName} Auth Internal] Browser.windows API is not available. Cannot open temporary window.`);
            return null;
        }

        let tempWindow: browser.Windows.Window | null = null;
        try {
            // Create the temporary window
            console.log(`[${serviceName} Auth Internal] Creating temporary window for ${targetUrl}...`);
            tempWindow = await browser.windows.create({
                url: targetUrl,
                focused: false,
                type: 'popup',
                width: 150,
                height: 150,
                // state: "minimized" // Try minimizing instead of off-screen coords? (May not work consistently)
            });
            console.log(`[${serviceName} Auth Internal] Temporary window created (ID: ${tempWindow?.id})`);

            const tabId = tempWindow?.tabs?.[0]?.id;
            if (!tabId) {
                throw new Error('Failed to get tab ID from temporary window.');
            }
             console.log(`[${serviceName} Auth Internal] Temporary tab ID: ${tabId}`);

            // Wait for the tab to likely finish loading
            console.log(`[${serviceName} Auth Internal] Waiting for temporary tab to load...`);
            await new Promise(resolve => setTimeout(resolve, 4000)); // 4 seconds delay

             // --- REAL INJECTION LOGIC ---
             console.log(`[${serviceName} Auth Internal] Attempting REAL extractor injection into temp tab ID: ${tabId}`);
             try {
                 const results = await browser.scripting.executeScript({
                     target: { tabId: tabId },
                     func: extractorFunc, // Use the actual extractor function
                     world: 'MAIN' as any // <<< Add world: 'MAIN' and type assertion
                 });
                 console.log(`[${serviceName} Auth Internal] REAL extractor script executed. Results:`, results);

                 if (results && results[0] && results[0].result) {
                     token = results[0].result; // Assign the token if found
                     console.log(`[${serviceName} Auth Internal] Successfully extracted REAL token via temporary tab.`);
                 } else {
                     console.warn(`[${serviceName} Auth Internal] Failed to extract REAL token via temporary tab.`, results);
                 }
             } catch (injectError) {
                 console.error(`[${serviceName} Auth Internal] Error injecting REAL extractor script:`, injectError);
                 // Token remains null
             }
             // --- END REAL INJECTION ---


        } catch (tabError) { // Catch errors from window creation or delay
            console.error(`[${serviceName} Auth Internal] Error creating/accessing temporary tab:`, tabError);
        } finally {
            // Ensure the temporary window is always closed
            console.log(`[${serviceName} Auth Internal] Entering finally block for temporary window.`);
            if (tempWindow?.id) {
                console.log(`[${serviceName} Auth Internal] Attempting to close temporary window ID: ${tempWindow.id}`);
                try {
                    await browser.windows.remove(tempWindow.id);
                    console.log(`[${serviceName} Auth Internal] Successfully closed temporary auth window.`);
                } catch (removeError) {
                     if (removeError instanceof Error && removeError.message.includes("No window with id")) {
                          console.log(`[${serviceName} Auth Internal] Temporary window already closed.`);
                     } else {
                          console.warn(`[${serviceName} Auth Internal] Error closing temporary auth window:`, removeError);
                     }
                }
            } else {
                 console.log(`[${serviceName} Auth Internal] No temporary window ID found to close in finally block.`);
            }
        }
        // End of temporary window logic block
    } // End of if (!token) check

    // 3. Return the final result (token might be null if all attempts failed)
    if (token) {
        console.log(`[${serviceName} Auth Internal] Token retrieval successful.`);
    } else {
        console.warn(`[${serviceName} Auth Internal] Failed to retrieve token after all attempts.`);
    }
    return token; // Return null if not found

} // End of _getTokenLogicInternal function


// --- Exported Wrapper (Called by Models/Popup) ---

/**
 * Sends a message to the background script requesting token retrieval.
 * Caching logic should be handled by the caller (the Model) if needed.
 *
 * @param serviceName - Unique name for logging/cache keys (e.g., 'deepseek').
 * @param targetUrl - Base URL of the target website.
 * @param urlPattern - URL pattern for permissions/tab querying.
 * @param extractorName - The *name* (string) of the exported extractor function in this file.
 * @param forceRefresh - If true, tells background to skip existing tab check (will still hit cache in caller).
 * @returns The extracted token string, or null. Throws on communication errors.
 */
export async function getTokenFromWebsite(
    serviceName: string,
    targetUrl: string,
    urlPattern: string,
    extractorName: 'deepseekExtractor' | 'copilotExtractor' | string, // Expects function name
    forceRefresh = false // Renamed from forceNewTab
): Promise<string | null> {
    console.log(`[${serviceName} Auth Wrapper] Requesting token from background (forceRefresh: ${forceRefresh})...`);

    // Optional: Check cache *before* messaging background (reduces unnecessary messages)
    // const cacheKey = `${TOKEN_CACHE_PREFIX}${serviceName}`;
    // if (!forceRefresh) { ... check cache logic ... }

    try {
        // Simple ping might not be sufficient if background is restarting.
        // Consider adding retry logic or more robust ready check if needed.
        const response = await browser.runtime.sendMessage({
            type: 'GET_AUTH_TOKEN_FROM_WEBSITE',
            payload: {
                serviceName,
                targetUrl,
                urlPattern,
                extractorName, // Pass the function NAME
                forceNewTab: forceRefresh, // Pass the flag to background
            },
        });

        console.log(`[${serviceName} Auth Wrapper] Received response from background:`, response);

        if (response?.success) {
             // Cache the successfully retrieved token (if not null) here or in the model?
             // Let's let the model handle caching for now.
            return response.token || null; // Return token or null if success=true but token missing
        } else {
            // Background script reported an error or failure
            const errorMessage = response?.error || `Unknown error from background script for ${serviceName}`;
            console.error(`[${serviceName} Auth Wrapper] Background script failed: ${errorMessage}`);
            // Throw a standard error that models can catch
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error(`[${serviceName} Auth Wrapper] Error communicating with background script:`, error);
        // Handle specific communication errors
        if (error instanceof Error && (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist"))) {
            const detailedError = "Background service communication error. Is the extension enabled/reloaded? Check background script logs.";
            console.error(detailedError);
            throw new Error(detailedError); // Throw specific error
        }
        // Re-throw other errors for the caller (model) to handle
        throw error;
    }
}

