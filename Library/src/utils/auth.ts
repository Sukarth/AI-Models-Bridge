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
  expiresAt: number;
}

const AUTH_CACHE: Record<string, AuthCache> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes default TTL
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh token 5 minutes before expiry

// Add notification preferences
let shouldNotifyTokenRefresh = true;

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
 * Get Copilot authorization token using tab method
 * @param forceRefresh Force refresh the token even if cached
 */
export async function getCopilotAuth(forceRefresh = false): Promise<string | null> {
  try {
    // Check if we have a valid cached token that's not about to expire
    if (!forceRefresh && 
        AUTH_CACHE['copilot'] && 
        AUTH_CACHE['copilot'].token && 
        AUTH_CACHE['copilot'].expiresAt > (Date.now() + TOKEN_REFRESH_THRESHOLD)) {
      console.log('Using cached Copilot auth token');
      return AUTH_CACHE['copilot'].token;
    }
    
    // If token is about to expire but still valid, use it but trigger a background refresh
    if (!forceRefresh && 
        AUTH_CACHE['copilot'] && 
        AUTH_CACHE['copilot'].token && 
        AUTH_CACHE['copilot'].expiresAt > Date.now()) {
      console.log('Token about to expire, triggering background refresh');
      // Trigger background refresh
      setTimeout(() => {
        // Notify about background refresh
        dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_START, { background: true });
        
        getCopilotTokenViaTab()
          .then(() => {
            dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_COMPLETE, { background: true });
          })
          .catch(err => {
            console.error('Background token refresh failed:', err);
            dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_ERROR, { 
              background: true,
              error: err.message 
            });
          });
      }, 0);
      
      // Return the current token
      return AUTH_CACHE['copilot'].token;
    }
    
    // Get a new token - notify about foreground refresh
    console.log('Getting new Copilot auth token');
    dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_START, { background: false });
    
    try {
      const token = await getCopilotTokenViaTab();
      
      // Notify that refresh is complete
      dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_COMPLETE, { background: false });
      
      if (token) {
        return token;
      }
    } catch (error) {
      dispatchAuthEvent(AUTH_EVENTS.TOKEN_REFRESH_ERROR, { 
        background: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
        
    console.error('Failed to get Copilot token');
    return null;
  } catch (error) {
    console.error('Error getting Copilot auth token:', error);
    return null;
  }
}

/**
 * Get Copilot token by opening a tab in a background window
 */
async function getCopilotTokenViaTab(): Promise<string | null> {
  if (typeof browser === 'undefined' || !browser.tabs || !browser.windows) {
    throw new Error('Tab method requires browser extension APIs');
  }
  
  let newWindow = null;
  try {
    newWindow = await browser.windows.create({ 
      url: "https://copilot.microsoft.com/",
      focused: false,
      type: "popup",
      width: 100,
      height: 100,
      left: 0,
      top: 0
    });
    
    // Get the tab ID from the window
    const tabId = newWindow.tabs?.[0]?.id;
    if (!tabId) {
      throw new Error('Failed to get tab ID from new window');
    }
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute script to extract the token
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try to find the token in localStorage
        for (let i = 0; i < localStorage.length; i++) {
          try {
            const key = localStorage.key(i);
            if (!key) continue;
            
            const item = JSON.parse(localStorage.getItem(key) || '');
            if (item.credentialType === "AccessToken" && 
                item.expiresOn > Math.floor(Date.now() / 1000) &&
                item.target?.includes("ChatAI")) {
              return {
                token: item.secret,
                expiresAt: item.expiresOn * 1000 // Convert to milliseconds
              };
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
        
        return null;
      }
    });
    
    // Process the result
    const tokenData = result?.[0]?.result;
    if (tokenData?.token) {
      // Cache the token
      AUTH_CACHE['copilot'] = {
        token: tokenData.token,
        cookies: {},
        timestamp: Date.now(),
        expiresAt: tokenData.expiresAt || (Date.now() + CACHE_TTL)
      };
      
      return tokenData.token;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting token via tab:', error);
    return null;
  } finally {
    // Close the window
    if (newWindow?.id) {
      try {
        await browser.windows.remove(newWindow.id);
      } catch (e) {
        console.error('Error closing auth window:', e);
      }
    }
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
 */
export function clearAuthCache(service?: string): void {
  if (service) {
    delete AUTH_CACHE[service];
  } else {
    Object.keys(AUTH_CACHE).forEach(key => {
      delete AUTH_CACHE[key];
    });
  }
}

/**
 * Check if a token is about to expire
 */
export function isTokenExpiringSoon(service: string): boolean {
  if (!AUTH_CACHE[service] || !AUTH_CACHE[service].expiresAt) {
    return true;
  }
  
  return AUTH_CACHE[service].expiresAt <= (Date.now() + TOKEN_REFRESH_THRESHOLD);
}

/**
 * Get token expiry time in milliseconds
 * @returns milliseconds until expiry or 0 if no token
 */
export function getTokenExpiryTime(service: string): number {
  if (!AUTH_CACHE[service] || !AUTH_CACHE[service].expiresAt) {
    return 0;
  }
  
  return Math.max(0, AUTH_CACHE[service].expiresAt - Date.now());
}