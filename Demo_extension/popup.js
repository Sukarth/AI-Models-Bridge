const {
  BardModel,
  BingModel,
  AIModelError,
  ErrorCode,
  configureAuth,
} = window.AIModelsBridge;

// DOM elements
const modelSelect = document.getElementById("model-select");
const apiKeyContainer = document.getElementById("api-key-container");
let apiKeyInput = document.getElementById("api-key");
const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send-button");
const responseDiv = document.getElementById("response");
const chatContainer = document.getElementById("chat-container");
const loadConversationsBtn = document.getElementById("load-conversations");
const conversationsList = document.getElementById("conversations-list");
const newThreadBtn = document.getElementById("new-thread-btn");
const imageUploadBtn = document.getElementById("image-upload-btn");
const imagePreview = document.getElementById("image-preview");
const bingModeToggle = document.createElement("div");

bingModeToggle.id = "bing-mode-toggle";
bingModeToggle.className = "hidden"; // Hide by default
bingModeToggle.innerHTML = `
  <div class="mode-toggle-container">
    <label class="mode-toggle">
      <span>Mode:</span>
      <select id="bing-mode-select">
        <option value="chat" selected>Chat</option>
        <option value="reasoning">Reasoning</option>
      </select>
      <span class="mode-info" title="Chat is conversational, Reasoning is more analytical">ⓘ</span>
    </label>
  </div>
`;

const inputContainer = document.querySelector(".input-container");
if (inputContainer) {
  inputContainer.insertBefore(
    bingModeToggle,
    document.querySelector(".button-container")
  );
} else {
  // Fallback if input-container doesn't exist
  const promptContainer = promptInput.parentElement;
  if (promptContainer) {
    promptContainer.insertBefore(bingModeToggle, promptInput);
  }
}

// Store the current model instance and selected image
let currentModel = null;
let selectedImage = null;
let currentThreadId = null;

// auth config settings to notify when auth token is refreshed 
configureAuth({notifyTokenRefresh: true});

// Create toast container if it doesn't exist
function createToastContainer() {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '1000';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Show a toast notification
function showToast(message, type = 'info', duration = 3000) {
  const toastContainer = createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  
  // Style the toast
  toast.style.backgroundColor = type === 'info' ? '#3498db' : '#e74c3c';
  toast.style.color = 'white';
  toast.style.padding = '10px 15px';
  toast.style.borderRadius = '4px';
  toast.style.marginTop = '10px';
  toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  toast.style.transition = 'all 0.3s ease';
  toast.style.opacity = '0';
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, duration);
  
  return toast;
}

// Update thread title in UI
function updateThreadTitle(title) {
  const threadTitleElement = document.getElementById('current-thread-title');
  if (threadTitleElement) {
    threadTitleElement.textContent = title || 'New Conversation';
  }
}

// Function to update API key container visibility based on selected model
function updateApiKeyContainer() {
  const model = modelSelect.value;

  if (model === "bard" || model === "bing" || model === "baichuan") {
    apiKeyContainer.innerHTML = `
      <div>No authentication needed</div>
    `;
    apiKeyContainer.children[0].style.padding = "0.5% 0 1.7% 0.3%";
    
    // Show Bing mode toggle only when Bing is selected
    if (model === "bing") {
      bingModeToggle.classList.remove("hidden");
    } else {
      bingModeToggle.classList.add("hidden");
    }
  } else if (model === "claude") {
    apiKeyContainer.innerHTML = `
      <div id="api-key-wrapper">
        <input type="password" id="api-key" placeholder="Enter sessionKey cookie value">
        <small>Get this from cookies when logged into Claude</small>
      </div>
    `;
  } else if (model === "openrouter") {
    apiKeyContainer.innerHTML = `
      <div id="api-key-wrapper">
        <input type="password" id="api-key" placeholder="Enter OpenRouter API Key">
        <input type="text" id="model-name" placeholder="Model name (e.g., anthropic/claude-2)">
      </div>
    `;
  } else {
    apiKeyContainer.innerHTML = `
      <div id="api-key-wrapper">
        <input type="password" id="api-key" placeholder="Enter API Key">
      </div>
    `;
  }

  // Re-assign the apiKeyInput reference for models that need it
  if (model !== "bard" && model !== "bing" && model !== "baichuan") {
    apiKeyInput = document.getElementById("api-key");
    if (apiKeyInput) {
      apiKeyInput.addEventListener("change", async () => {
        await chrome.storage.local.set({ apiKey: apiKeyInput.value });
      });

      chrome.storage.local.get(["apiKey"], (result) => {
        if (result.apiKey) {
          apiKeyInput.value = result.apiKey;
        }
      });
    }
  }
}

// Initialize the UI
async function initUI() {
  // Load saved API key and model
  const result = await chrome.storage.local.get([
    "apiKey",
    "selectedModel",
    "currentThreadId",
  ]);

  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.selectedModel) {
    modelSelect.value = result.selectedModel;
  }

  updateApiKeyContainer();

  // Add event listeners
  // In the modelSelect event listener (around line 80)
  modelSelect.addEventListener("change", async () => {
    updateApiKeyContainer();
    await chrome.storage.local.set({ selectedModel: modelSelect.value });
    // Reset current model when changing model type
    currentModel = null;
    currentThreadId = null;
    await chrome.storage.local.remove(["currentThreadId"]);
    clearChatDisplay();
    
    // Close conversations list if open
    conversationsList.classList.add("hidden");
  });
  
  // In the createNewThread function (around line 452)
  async function createNewThread(showNotification = true) {
    try {
      // Close conversations list if open
      conversationsList.classList.add("hidden");
      
      if (!currentModel) {
        currentModel = createModel();
      }
  
      await currentModel.initNewThread();
  
      if (currentModel.currentThread) {
        currentThreadId = currentModel.currentThread.id;
        await chrome.storage.local.set({ currentThreadId });
        updateThreadTitle(currentModel.currentThread.title);
      }
  
      clearChatDisplay();
  
      if (showNotification) {
        // Replace the notification with a welcome message
        displayWelcomeMessage();
      }
    } catch (error) {
      console.error("Error creating thread:", error);
      const errorElement = document.createElement("div");
      errorElement.className = "message assistant-message";
      errorElement.textContent = `Error creating new thread: ${error.message}`;
      chatContainer.appendChild(errorElement);
    }
  }
  apiKeyInput?.addEventListener("change", async () => {
    await chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  sendButton.addEventListener("click", sendMessage);
  loadConversationsBtn.addEventListener("click", loadThreadsList);
  newThreadBtn.addEventListener("click", createNewThread);
  imageUploadBtn.addEventListener("change", handleImageUpload);

  // Listen for auth events
document.addEventListener(window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_START, (event) => {
  if (!event.detail.background) {
    showToast('Refreshing auth token...', 'info');
  }
});

document.addEventListener(window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_COMPLETE, (event) => {
  if (!event.detail.background) {
    showToast('Auth token refreshed!', 'info', 2000);
  }
});

document.addEventListener(window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_ERROR, (event) => {
  showToast(`Auth error: ${event.detail.error}`, 'error', 5000);
});

  // Try to load the last active thread if available
  if (result.currentThreadId) {
    currentThreadId = result.currentThreadId;
    await initializeModelAndLoadThread();
  } else {
    // Only load threads list if no current thread
    await loadThreadsList();
  }
}

// Initialize model and load the current thread
async function initializeModelAndLoadThread() {
  try {
    if (!currentModel) {
      currentModel = createModel();
    }

    if (currentThreadId) {
      await currentModel.loadThread(currentThreadId);
      displayThreadMessages();
    } else {
      // If no thread ID, create a new thread
      await createNewThread();
    }
  } catch (error) {
    console.error("Error initializing model or loading thread:", error);
    chatContainer.innerHTML = `<div class="message assistant-message">Error: ${error.message}</div>`;
  }
}

// Display all messages from the current thread
function displayThreadMessages() {
  if (!currentModel || !currentModel.currentThread) {
    return;
  }

  clearChatDisplay();
  updateThreadTitle(currentModel.currentThread.title);

  const messages = currentModel.currentThread.messages;
  if (messages && messages.length > 0) {
    messages.forEach((message) => {
      const messageElement = document.createElement("div");
      messageElement.className = `message ${
        message.role === "user" ? "user-message" : "assistant-message"
      }`;
      
      // Check if this message has an image
      if (message.role === "user" && (message.metadata?.imageDataUrl || message.metadata?.imageUrl)) {
        // Create HTML with image and text - use dataUrl if available, otherwise fall back to imageUrl
        const imageSource = message.metadata.imageDataUrl || message.metadata.imageUrl;
        // try to show/lo image, but if it fails, show 'image unavailable' SVG on failure to load image 
        messageElement.innerHTML = `
          <div class="message-image-container">
            <img src="${imageSource}" alt="User uploaded image" class="message-image" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';">
          </div>
          <div class="message-text">${message.content}</div>
        `;
      } else {
        messageElement.textContent = message.content;
      }
      
      chatContainer.appendChild(messageElement);
      
      // Add suggested followups if available
      if (message.role === "assistant" && message.metadata?.suggestedResponses) {
        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.className = "suggestions-container";
        
        message.metadata.suggestedResponses.forEach((suggestion) => {
          const suggestionButton = document.createElement("button");
          suggestionButton.className = "suggestion-btn";
          suggestionButton.textContent = suggestion;
          suggestionButton.addEventListener("click", () => {
            promptInput.value = suggestion;
            sendMessage();
          });
          suggestionsContainer.appendChild(suggestionButton);
        });
        
        chatContainer.appendChild(suggestionsContainer);
      }
    });

    // Scroll to the bottom
    responseDiv.scrollTop = responseDiv.scrollHeight;
  } else {
    // Display welcome message if there are no messages
    displayWelcomeMessage();
  }
}

// function checkForSuggestedResponses() {
//   if (currentModel && currentModel.currentThread) {
//     const messages = currentModel.currentThread.messages;
//     if (messages && messages.length > 0) {
//       const lastMessage = messages[messages.length - 1];
//       console.log("Checking last message for suggestions:", lastMessage);

//       if (
//         lastMessage.role === "assistant" &&
//         lastMessage.metadata?.suggestedResponses
//       ) {
//         const existingSuggestions = chatContainer.querySelector(
//           ".suggestions-container:last-child"
//         );
//         if (!existingSuggestions) {
//           displaySuggestedResponses(lastMessage.metadata.suggestedResponses);
//         }
//       }
//     }
//   }
// }

// Handle image upload
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    selectedImage = file;

    // Show image preview
    const reader = new FileReader();
    reader.onload = function (e) {
      imagePreview.innerHTML = `
        <div class="image-preview-container">
          <img src="${e.target.result}" alt="Selected image" class="preview-image">
          <button id="remove-image-btn" class="remove-btn">×</button>
        </div>
      `;

      // Add remove button functionality
      document
        .getElementById("remove-image-btn")
        .addEventListener("click", () => {
          imagePreview.innerHTML = "";
          selectedImage = null;
          imageUploadBtn.value = "";
        });
    };
    reader.readAsDataURL(file);
  }
}

// In the sendMessage function, after processing the image
async function sendMessage() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert("Please enter a message");
    return;
  }

  try {
    // Initialize model if needed
    if (!currentModel) {
      currentModel = createModel();
    }

    // Only create new thread if none exists
    if (!currentThreadId) {
      const threads = await currentModel.getAllThreads();
      if (threads.length > 0) {
        // Load the most recent thread
        const mostRecent = threads
          .filter(t => t.modelName === currentModel.getName())
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (mostRecent) {
          await loadThread(mostRecent.id);
        } else {
          await createNewThread(false);
        }
      } else {
        await createNewThread(false);
      }
    }

    // Disable the send button and show loading indicator
    sendButton.disabled = true;

    // Get the selected image if any
    const imageFile = selectedImage;
    let imageDataUrl = null;
    
    // If we have an image, get its data URL for display in the chat
    if (imageFile) {
      imageDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(imageFile);
      });
    }

    // Add user message to the display with image if present
    const userMessageElement = document.createElement("div");
    userMessageElement.className = "message user-message";
    
    // If we have an image, add it to the message
    if (imageDataUrl) {
      userMessageElement.innerHTML = `
        <div class="message-image-container">
          <img src="${imageDataUrl}" alt="User uploaded image" class="message-image">
        </div>
        <div class="message-text">${prompt}</div>
      `;
    } else {
      userMessageElement.textContent = prompt;
    }
    
    chatContainer.appendChild(userMessageElement);

    // Clear the input and image preview
    promptInput.value = "";
    selectedImage = null;
    imagePreview.innerHTML = "";
    
    // Clear the file input value to reset the "Choose File" button text
    if (imageUploadBtn) {
      imageUploadBtn.value = "";
    }

    // Create a div for the assistant's response
    const assistantMessageElement = document.createElement("div");
    assistantMessageElement.className = "message assistant-message";
    assistantMessageElement.textContent = "...";
    chatContainer.appendChild(assistantMessageElement);

    // Scroll to the bottom
    responseDiv.scrollTop = responseDiv.scrollHeight;

    try {
      console.log("Sending message to model:", prompt);
      console.log("Current model type:", currentModel.getName());
      
      // Get the Bing mode if applicable
      let bingMode = undefined;
      if (modelSelect.value === "bing" && !bingModeToggle.classList.contains("hidden")) {
        const modeSelect = document.getElementById("bing-mode-select");
        if (modeSelect) {
          bingMode = modeSelect.value;
          console.log("Using Bing mode:", bingMode);
        }
      }
      
      // Create options object with proper callbacks
      const options = {
        image: imageFile,
        signal: null, // TODO: Implement abort signal
        ...(bingMode && { mode: bingMode }), // Add mode property to options only if bingMode exists
        onEvent: (event) => {
          // Event handling code remains the same
          console.log("Event received:", event);

          if (!event) return;

          // Handle standard event types from abstract-bot.ts
          if (event.type === "UPDATE_ANSWER" && event.data?.text) {
            console.log("Update answer:", event.data.text);
            assistantMessageElement.textContent = event.data.text;
            responseDiv.scrollTop = responseDiv.scrollHeight;
          } else if (event.type === "DONE") {
            console.log("Done event received");
            sendButton.disabled = false;

            // setTimeout(() => checkForSuggestedResponses(), 500);
          } else if (event.type === "TITLE_UPDATE") {
            console.log("Title update:", event.data.title);
            // Update the title in the UI
            const titleElement = document.getElementById(
              "current-thread-title"
            );
            if (titleElement) {
              titleElement.textContent = event.data.title;
            }
          }
          // Handle Bing-specific events
          else if (
            event.type === "SUGGESTED_RESPONSES" &&
            event.data?.suggestions
          ) {
            console.log(
              "Suggested responses received:",
              event.data.suggestions
            );
            displaySuggestedResponses(event.data.suggestions);
          } else if (event.type === "ERROR") {
            console.error("Error event:", event.error);
            assistantMessageElement.textContent =
              "Error: " + getErrorMessage(event.error);
            sendButton.disabled = false;
          }

          // // Handle events with different structure (like Bing's format)
          // else if (typeof event === 'object') {
          //   // Try to normalize the event structure
          //   const normalizedEvent = {
          //     type: event.type || (event.data?.type || ''),
          //     data: event.data || event
          //   };

          //   console.log("Normalized event:", normalizedEvent);

          //   if (normalizedEvent.type === 'suggested_responses' && normalizedEvent.data?.suggestions) {
          //     displaySuggestedResponses(normalizedEvent.data.suggestions);
          //   }
          // }
        },
      };
      // if (modelSelect.value === "bing") {
      //   const modeSelect = document.getElementById("bing-mode-select");
      //   if (modeSelect) {
      //     options.mode = modeSelect.value;  
      //     console.log("Setting Bing mode in options:", options.mode);

      //     // Debug the entire options object
      //     console.log("Full options object:", JSON.stringify({
      //       hasImage: !!options.image,
      //       hasSignal: !!options.signal,
      //       hasOnEvent: !!options.onEvent,
      //       mode: options.mode
      //     }));
      //   }
      // }
      // // if (bingMode) {
      // //   options.mode = bingMode;
      // // }
      
      
      // // Call sendMessage with the options
      // if (modelSelect.value === "bing" && options.mode) {
      //   // Store the mode in a separate variable to ensure it's not lost
      //   const selectedMode = options.mode;
      //   console.log("Selected mode before sending:", selectedMode);
        
      //   // Add a custom property to ensure the mode is passed through
      //   options._bingMode = selectedMode;
        
      //   // Call sendMessage with the options
      //   await currentModel.sendMessage(prompt, options);
      // } else {
      //   // For other models, just call sendMessage normally
      //   await currentModel.sendMessage(prompt, options);
      // }
      
      // // Add a manual check for completion if events aren't firing
      // setTimeout(() => {
      //   if (sendButton.disabled) {
      //     console.log("Timeout reached - manually re-enabling send button");
      //     sendButton.disabled = false;
      //     checkForSuggestedResponses();
      //   }
      // }, 10000); // 10 second timeout as a fallback
      
      await currentModel.sendMessage(prompt, options);
      console.log("Message sent successfully");
      
    } catch (error) {
      console.error("Error sending message:", error);
      assistantMessageElement.textContent = "Error: " + getErrorMessage(error);
      sendButton.disabled = false;
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred: " + getErrorMessage(error));
    sendButton.disabled = false;
  }
}

// Load the list of threads
async function loadThreadsList() {
  try {

    if (!conversationsList.classList.contains("hidden")) {
      conversationsList.classList.add("hidden");
      return;
    }

    if (!currentModel) {
      currentModel = createModel();
    }

    const threads = await currentModel.getAllThreads();
    
    // Filter threads for the current model
    const modelThreads = threads.filter(
      (thread) => thread.modelName === currentModel.getName()
    );

    conversationsList.innerHTML = "";
    conversationsList.classList.remove("hidden");

    if (modelThreads.length === 0) {
      const noThreadsMsg = document.createElement("div");
      noThreadsMsg.className = "no-threads-msg";
      noThreadsMsg.textContent = "No conversations found";
      conversationsList.appendChild(noThreadsMsg);
      return;
    }

    // Sort threads by most recent first
    modelThreads.sort((a, b) => b.updatedAt - a.updatedAt);

    // Create a header for the conversations list
    const listHeader = document.createElement("div");
    listHeader.className = "threads-header";
    listHeader.textContent = "Your Conversations";
    conversationsList.appendChild(listHeader);

    // Create a container for the threads
    const threadsContainer = document.createElement("div");
    threadsContainer.className = "threads-container";
    conversationsList.appendChild(threadsContainer);

    modelThreads.forEach((thread) => {
      const threadItem = document.createElement("div");
      threadItem.className = "thread-item";
      // Add active class if this is the current thread
      if (currentThreadId === thread.id) {
        threadItem.classList.add("active-thread");
      }
      threadItem.dataset.threadId = thread.id;
      
      // Create title element
      const titleElement = document.createElement("div");
      titleElement.className = "thread-title";
      titleElement.textContent = thread.title || `Conversation ${new Date(thread.createdAt).toLocaleString()}`;
      threadItem.appendChild(titleElement);
      
      // Create date element with friendly time format
      const dateElement = document.createElement("div");
      dateElement.className = "thread-date";
      dateElement.textContent = `Last updated: ${formatRelativeTime(thread.updatedAt)}`;
      threadItem.appendChild(dateElement);
      
      threadItem.addEventListener("click", async () => {
        await loadThread(thread.id);
        conversationsList.classList.add("hidden");
      });
      
      threadsContainer.appendChild(threadItem);
    });
  } catch (error) {
    console.error("Error loading threads:", error);
    alert("Failed to load conversations: " + getErrorMessage(error));
  }
}

// Format relative time in a user-friendly way
function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  // For very recent updates (less than a minute ago)
  if (diffInSeconds < 60) {
    return "just now";
  }
  
  // For updates within the last hour
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // For updates within 5 hours
  if (diffInHours < 5) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Format the time string
  const timeString = date.toLocaleTimeString(undefined, { 
    hour: '2-digit', 
    minute: '2-digit'
  });
  
  // Check if it's today
  const isToday = now.toDateString() === date.toDateString();
  if (isToday) {
    return `today, at ${timeString}`;
  }
  
  // Check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `yesterday, at ${timeString}`;
  }
  
  // Check if it's day before yesterday
  const dayBeforeYesterday = new Date(now);
  dayBeforeYesterday.setDate(now.getDate() - 2);
  if (dayBeforeYesterday.toDateString() === date.toDateString()) {
    return `day before yesterday, at ${timeString}`;
  }
  
  // For updates within the current week
  if (diffInDays < 7) {
    const weekdayName = date.toLocaleDateString(undefined, { weekday: 'long' });
    return `${weekdayName}, at ${timeString}`;
  }
  
  // For older updates
  const formattedDate = date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long'
  });
  return `${formattedDate}, at ${timeString}`;
}

// Create a model instance based on the selected model
function createModel() {
  const modelType = modelSelect.value;
  const apiKey = apiKeyInput?.value || '';

  switch (modelType) {
    case "chatgpt":
      if (!apiKey) throw new Error("API key is required for ChatGPT");
      return new window.AIModelsBridge.ChatGPTApiModel({
        apiKey,
        model: "gpt-3.5-turbo",
      });

    case "bard":
      return new BardModel();
      
    case "bing":
      return new BingModel();
    
    case "claude":
      if (!apiKey) throw new Error("Session key is required for Claude");
      return new window.AIModelsBridge.ClaudeWebModel({
        sessionKey: apiKey,
      });

    case "openrouter":
      const modelName =
        document.getElementById("model-name")?.value || "anthropic/claude-2";
      return new window.AIModelsBridge.OpenRouterModel({
        apiKey,
        model: modelName,
      });

    case "gemini":
      return new window.AIModelsBridge.GeminiApiModel({
        apiKey,
      });

    case "baichuan":
      return new window.AIModelsBridge.BaichuanWebModel();

    default:
      throw new Error("Unknown model selected");
  }
}

// Get a user-friendly error message
function getErrorMessage(error) {
  if (!error) return "Unknown error occurred";
  
  if (error.code) {
    switch (error.code) {
      case ErrorCode.UNAUTHORIZED:
        return "Authentication failed. Check your API key or session cookies.";
      case ErrorCode.SERVICE_UNAVAILABLE:
        return "The AI service is currently unavailable.";
      case ErrorCode.MISSING_API_KEY:
        return "API key is required but not provided.";
      case ErrorCode.INVALID_REQUEST:
        return "Invalid request. Please check your input.";
      default:
        return `Error: ${error.message || 'Unknown error'}`;
    }
  }
  
  return error.message || "Unknown error occurred";
}


// Display a welcome message when conversation is empty
function displayWelcomeMessage() {
  const welcomeElement = document.createElement("div");
  welcomeElement.className = "welcome-message";
  
  // Choose a random welcome message
  const welcomeMessages = [
    "What would you like to know today?",
    "What's on your mind today?",
    "Ask me anything...",
    "How can I assist you today?",
    "Ready when you are! Type a message to begin.",
    "What are you curious about?",
    "What would you like to explore today?"
  ];
  
  const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  welcomeElement.textContent = randomMessage;
  
  chatContainer.appendChild(welcomeElement);
}

// Clear the chat display
function clearChatDisplay() {
  chatContainer.innerHTML = "";
}

// Add a helper function to display suggested responses
function displaySuggestedResponses(suggestions) {
  if (!suggestions || !suggestions.length) return;
  
  console.log('Displaying suggested responses:', suggestions);
  
  const suggestionsContainer = document.createElement("div");
  suggestionsContainer.className = "suggestions-container";
  
  suggestions.forEach(suggestion => {
    const suggestionBtn = document.createElement('button');
    suggestionBtn.className = 'suggestion-btn';
    suggestionBtn.textContent = suggestion;
    suggestionBtn.addEventListener('click', () => {
      promptInput.value = suggestion;
      sendMessage();
    });
    suggestionsContainer.appendChild(suggestionBtn);
  });
  
  chatContainer.appendChild(suggestionsContainer);
}

// Load a specific thread by ID
async function loadThread(threadId) {
  try {
    if (!currentModel) {
      currentModel = createModel();
    }
    
    await currentModel.loadThread(threadId);
    currentThreadId = threadId;
    await chrome.storage.local.set({ currentThreadId });
    
    displayThreadMessages();
    
    // Update the title if available
    const titleElement = document.getElementById("current-thread-title");
    if (titleElement && currentModel.currentThread?.title) {
      titleElement.textContent = currentModel.currentThread.title;
    }
    
    console.log("Thread loaded successfully:", threadId);
  } catch (error) {
    console.error("Error loading thread:", error);
    alert("Failed to load conversation: " + getErrorMessage(error));
  }
}

// Initialize the UI when the popup is loaded
document.addEventListener("DOMContentLoaded", initUI);