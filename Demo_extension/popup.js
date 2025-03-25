const {
  ChatGPTApiModel,
  BardModel,
  ClaudeWebModel,
  OpenRouterModel,
  GeminiApiModel,
  BaichuanWebModel,
  AIModelError,
  ErrorCode
} = AIModelsBridge;

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

// Store the current model instance and selected image
let currentModel = null;
let selectedImage = null;
let currentThreadId = null;

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
  modelSelect.addEventListener("change", async () => {
    updateApiKeyContainer();
    await chrome.storage.local.set({ selectedModel: modelSelect.value });
    // Reset current model when changing model type
    currentModel = null;
    currentThreadId = null;
    await chrome.storage.local.remove(["currentThreadId"]);
    clearChatDisplay();
  });

  apiKeyInput?.addEventListener("change", async () => {
    await chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  sendButton.addEventListener("click", sendMessage);
  loadConversationsBtn.addEventListener("click", loadThreadsList);
  newThreadBtn.addEventListener("click", createNewThread);

  // Image upload handling
  imageUploadBtn.addEventListener("change", handleImageUpload);

  // Try to load the last active thread if available
  if (result.currentThreadId) {
    currentThreadId = result.currentThreadId;
    await initializeModelAndLoadThread();
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

  const messages = currentModel.currentThread.messages;
  if (messages && messages.length > 0) {
    messages.forEach((message) => {
      const messageElement = document.createElement("div");
      messageElement.className = `message ${
        message.role === "user" ? "user-message" : "assistant-message"
      }`;
      messageElement.textContent = message.content;
      chatContainer.appendChild(messageElement);
    });

    // Scroll to the bottom
    responseDiv.scrollTop = responseDiv.scrollHeight;
  }
}

// Clear the chat display
function clearChatDisplay() {
  chatContainer.innerHTML = "";
}

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

// Update the API key container based on the selected model
function updateApiKeyContainer() {
  const model = modelSelect.value;

  if (model === "bard") {
    apiKeyContainer.innerHTML = `
      <small>No authentication needed</small>
    `;
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
  } else if (model === "baichuan") {
    apiKeyContainer.innerHTML = `
      <small>No authentication needed</small>
    `;
  } else {
    apiKeyContainer.innerHTML = `
      <div id="api-key-wrapper">
        <input type="password" id="api-key" placeholder="Enter API Key">
      </div>
    `;
  }

  // Re-assign the apiKeyInput reference for models that need it
  if (model !== "bard" && model !== "baichuan") {
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

// Create a model instance based on the selected model
function createModel() {
  const model = modelSelect.value;
  const apiKey = apiKeyInput?.value;

  switch (model) {
    case "chatgpt":
      if (!apiKey) throw new Error("API key is required for ChatGPT");
      return new ChatGPTApiModel({
        apiKey,
        model: "gpt-3.5-turbo",
      });

    case "bard":
      return new BardModel();

    case "claude":
      if (!apiKey) throw new Error("Session key is required for Claude");
      return new ClaudeWebModel({
        sessionKey: apiKey,
      });

    case "openrouter":
      const modelName =
        document.getElementById("model-name")?.value || "anthropic/claude-2";
      return new OpenRouterModel({
        apiKey,
        model: modelName,
      });

    case "gemini":
      return new GeminiApiModel({
        apiKey,
      });

    case "baichuan":
      return new BaichuanWebModel();

    default:
      throw new Error("Unknown model selected");
  }
}

// Send a message to the selected model
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

    // Initialize thread if needed
    if (!currentThreadId) {
      await createNewThread(false); // Create thread without notification
    }

    // Disable the send button and show loading indicator
    sendButton.disabled = true;

    // Add user message to the display
    const userMessageElement = document.createElement("div");
    userMessageElement.className = "message user-message";
    userMessageElement.textContent = prompt;
    chatContainer.appendChild(userMessageElement);

    // Add a placeholder for the assistant's response
    const assistantMessageElement = document.createElement("div");
    assistantMessageElement.className = "message assistant-message";
    assistantMessageElement.textContent = "Thinking...";
    chatContainer.appendChild(assistantMessageElement);

    // Scroll to the bottom
    responseDiv.scrollTop = responseDiv.scrollHeight;

    // Send the message with image if selected
    await currentModel.sendMessage(prompt, {
      image: selectedImage,
      onProgress: (text) => {
        assistantMessageElement.textContent = text;
        responseDiv.scrollTop = responseDiv.scrollHeight;
      },
    });

    // Save the current thread ID
    if (currentModel.currentThread) {
      currentThreadId = currentModel.currentThread.id;
      await chrome.storage.local.set({ currentThreadId });
    }

    // Clear input and image after successful send
    promptInput.value = "";
    if (selectedImage) {
      selectedImage = null;
      imagePreview.innerHTML = "";
      imageUploadBtn.value = "";
    }
  } catch (error) {
    const errorMessage =
      error instanceof AIModelError
        ? getErrorMessage(error)
        : `Unexpected error: ${error.message}`;

    const errorElement = document.createElement("div");
    errorElement.className = "message assistant-message";
    errorElement.textContent = errorMessage;
    chatContainer.appendChild(errorElement);

    console.error("Error:", error);
  } finally {
    sendButton.disabled = false;
  }
}

// Get a user-friendly error message
function getErrorMessage(error) {
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
      return `Error: ${error.message}`;
  }
}

// Create a new thread
async function createNewThread(showNotification = true) {
  try {
    if (!currentModel) {
      currentModel = createModel();
    }

    await currentModel.initNewThread();

    if (currentModel.currentThread) {
      currentThreadId = currentModel.currentThread.id;
      await chrome.storage.local.set({ currentThreadId });
    }

    clearChatDisplay();

    if (showNotification) {
      const notificationElement = document.createElement("div");
      notificationElement.className = "message assistant-message";
      notificationElement.textContent = "New conversation started.";
      chatContainer.appendChild(notificationElement);
    }
  } catch (error) {
    console.error("Error creating thread:", error);
    const errorElement = document.createElement("div");
    errorElement.className = "message assistant-message";
    errorElement.textContent = `Error creating new thread: ${error.message}`;
    chatContainer.appendChild(errorElement);
  }
}

// Load the list of threads
async function loadThreadsList() {
  try {
    if (!currentModel) {
      currentModel = createModel();
    }

    const threads = await currentModel.loadThreadsFromStorage();
    const modelThreads = threads.filter(
      (t) => t.modelName === currentModel.getName()
    );

    if (modelThreads.length === 0) {
      conversationsList.innerHTML = "<p>No saved conversations found</p>";
    } else {
      conversationsList.innerHTML = modelThreads
        .map(
          (thread) => `
          <div class="conversation-item" data-id="${thread.id}">
            <div>${
              thread.title ||
              "Conversation from " + new Date(thread.createdAt).toLocaleString()
            }</div>
            <small>${new Date(thread.updatedAt).toLocaleString()}</small>
          </div>
        `
        )
        .join("");
    }

    conversationsList.classList.remove("hidden");

    // Add click handlers
    document.querySelectorAll(".conversation-item").forEach((item) => {
      item.addEventListener("click", () => loadThread(item.dataset.id));
    });
  } catch (error) {
    alert("Failed to load conversations: " + error.message);
  }
}

// Load a specific thread
async function loadThread(threadId) {
  try {
    if (!currentModel) {
      currentModel = createModel();
    }

    await currentModel.loadThread(threadId);
    currentThreadId = threadId;
    await chrome.storage.local.set({ currentThreadId });

    conversationsList.classList.add("hidden");
    displayThreadMessages();
  } catch (error) {
    alert("Failed to load conversation: " + error.message);
  }
}

// Initialize the UI when the popup is loaded
document.addEventListener("DOMContentLoaded", initUI);