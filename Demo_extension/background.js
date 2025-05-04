/**
 * Background Service Worker for AI Models Bridge Demo
 * Handles tasks like authentication window creation that cannot run in the popup.
 */
import browser from 'webextension-polyfill';

// Import necessary functions from the bundled library module
// These functions must be exported from Library/src/index.ts
import {
    executeTokenRetrievalLogic, // The internal logic function (needs export from index)
    deepseekExtractor,         // Specific extractor for Deepseek (needs export from index)
    copilotExtractor           // Specific extractor for Copilot (needs export from index)
} from './lib/ai-models-bridge.esm.js';

console.log("Background script loaded.");

// Map extractor names (strings) received in messages to actual functions
const extractorFunctions = {
    deepseekExtractor: deepseekExtractor,
    copilotExtractor: copilotExtractor,
};

// Listener for messages from the popup or other extension parts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Received message:", message?.type);

    if (message.type === 'GET_AUTH_TOKEN_FROM_WEBSITE') {
        const {
            serviceName,
            targetUrl,
            urlPattern,
            extractorName, // Name of the function
            forceNewTab
        } = message.payload || {}; // Use default empty object

        // Validate payload
        if (!serviceName || !targetUrl || !urlPattern || !extractorName) {
             console.error("[Background] Invalid payload received for GET_AUTH_TOKEN_FROM_WEBSITE:", message.payload);
             sendResponse({ success: false, error: "Invalid payload received by background script." });
             return false; // Synchronous response (error)
        }

        const extractorFunc = extractorFunctions[extractorName];

        if (!extractorFunc) {
             console.error(`[Background] Unknown extractor function name received: ${extractorName}`);
             sendResponse({ success: false, error: `Unknown extractor function: ${extractorName}` });
             return false; // Synchronous response (error)
        }

        console.log(`[Background] Processing token request for service: ${serviceName} using extractor: ${extractorName}`);

        // Call the internal logic function asynchronously
        // Ensure _getTokenFromWebsiteLogic is correctly imported and available
        executeTokenRetrievalLogic(
            serviceName,
            targetUrl,
            urlPattern,
            extractorFunc, // Pass the actual function
            forceNewTab ?? false // Default forceNewTab to false if undefined
        ).then(token => {
            console.log(`[Background ${serviceName}] Token result:`, token ? 'Token Found' : 'Not Found');
            sendResponse({ success: true, token: token || null }); // Ensure token is null if falsy
        }).catch(error => {
             console.error(`[Background ${serviceName}] Error retrieving token:`, error);
             sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        });

        // Indicate that the response will be sent asynchronously
        return true;

    } else if (message.type === 'PING') {
         // Simple ping handler to confirm background script is active
         console.log("[Background] Received PING from", sender?.tab?.id || sender?.id);
         sendResponse({ success: true, message: 'PONG' });
         return false; // Synchronous response
    }

    // Return false if the message type isn't handled or if response is synchronous
    return false;
});

console.log("Background script message listener attached.");

// Optional Keep-alive (less critical in MV3 but sometimes useful)
// chrome.runtime.onInstalled.addListener(() => {
//   chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
// });
// chrome.alarms.onAlarm.addListener(alarm => {
//   if (alarm.name === 'keepAlive') { } // Do nothing, just wake up
// });