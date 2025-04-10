const {
  BardModel,
  BingModel,
  ClaudeWebModel,
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
const claudeStylesContainer = document.getElementById("claude-styles-container");
const claudeStyleSelect = document.getElementById("claude-style-select");
const editTitleBtn = document.getElementById("edit-title-btn");
const shareConversationBtn = document.createElement("button");
const threadTitleContainer = document.getElementById("thread-title-container");
const deleteConversationBtn = document.createElement("button");

shareConversationBtn.id = "share-conversation-btn";
shareConversationBtn.className = "icon-btn";
shareConversationBtn.title = "Share conversation";
shareConversationBtn.innerHTML = "🔗";
shareConversationBtn.style.display = "none"; // Hide by default

deleteConversationBtn.id = "delete-conversation-btn";
deleteConversationBtn.className = "icon-btn";
deleteConversationBtn.title = "Delete conversation";
deleteConversationBtn.innerHTML = "🗑️";
deleteConversationBtn.style.display = "none"; // Hide by default

if (threadTitleContainer) {
  threadTitleContainer.appendChild(shareConversationBtn);
  threadTitleContainer.appendChild(deleteConversationBtn);
}

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
let claudeStyles = [];
let selectedStyleKey = "";
let currentStyleKey = null;
let bingMode = null;

// auth config settings to notify when auth token is refreshed
configureAuth({ notifyTokenRefresh: true });

// Create toast container if it doesn't exist
function createToastContainer() {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "20px";
    toastContainer.style.right = "20px";
    toastContainer.style.zIndex = "1000";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Show a toast notification
function showToast(message, type = "info", duration = 3000) {
  const toastContainer = createToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;

  // Style the toast
  toast.style.backgroundColor = type === "info" ? "#3498db" : "#e74c3c";
  toast.style.color = "white";
  toast.style.padding = "10px 15px";
  toast.style.borderRadius = "4px";
  toast.style.marginTop = "10px";
  toast.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  toast.style.transition = "all 0.3s ease";
  toast.style.opacity = "0";

  toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, duration);

  return toast;
}

// Update thread title in UI
function updateThreadTitle(title) {
  const threadTitleElement = document.getElementById("current-thread-title");
  if (threadTitleElement) {
    threadTitleElement.textContent = title || "New Conversation";
    threadTitleElement.style.display = "";
    editTitleBtn.style.display = "";
  }
}

// Function to update API key container visibility based on selected model
function updateApiKeyContainer() {
  const selectedModel = modelSelect.value;

  // Reset styles when changing models
  claudeStylesContainer.classList.add("hidden");
  bingModeToggle.classList.add("hidden");
  claudeStyleSelect.innerHTML = '';

  if (selectedModel === "claude") {
    apiKeyContainer.classList.add("hidden");
    // apiKeyInput.placeholder = "Enter Claude Session Key (optional)";

    // Show Claude styles container
    claudeStylesContainer.classList.remove("hidden");

    // Load Claude styles if we have a model
    if (currentModel) {
      loadClaudeStyles();
    }
  } else if (selectedModel === "bing") {
    apiKeyContainer.classList.add("hidden");
    bingModeToggle.classList.remove("hidden");
  } else if (selectedModel === "bard") {
    apiKeyContainer.classList.add("hidden");
  } else {
    apiKeyContainer.classList.remove("hidden");
    apiKeyInput.placeholder = "Enter API Key";
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

  // Add event listener for Claude style selection
  claudeStyleSelect.addEventListener("change", async () => {
    currentStyleKey = claudeStyleSelect.value;
    await chrome.storage.local.set({ claudeStyleKey: currentStyleKey });
  });

  apiKeyInput?.addEventListener("change", async () => {
    await chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  sendButton.addEventListener("click", sendMessage);
  loadConversationsBtn.addEventListener("click", loadThreadsList);
  newThreadBtn.addEventListener("click", createNewThread);
  imageUploadBtn.addEventListener("change", handleImageUpload);
  editTitleBtn.addEventListener("click", showTitleEditForm);
  shareConversationBtn.addEventListener("click", shareConversation);
  deleteConversationBtn.addEventListener("click", confirmDeleteConversation);

  // Listen for auth events
  document.addEventListener(
    window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_START,
    (event) => {
      if (!event.detail.background) {
        showToast("Refreshing auth token...", "info");
      }
    }
  );

  document.addEventListener(
    window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_COMPLETE,
    (event) => {
      if (!event.detail.background) {
        showToast("Auth token refreshed!", "info", 2000);
      }
    }
  );

  document.addEventListener(
    window.AIModelsBridge.AUTH_EVENTS.TOKEN_REFRESH_ERROR,
    (event) => {
      showToast(`Auth error: ${event.detail.error}`, "error", 5000);
    }
  );

  // Try to load the last active thread if available
  if (result.currentThreadId) {
    currentThreadId = result.currentThreadId;
    await initializeModelAndLoadThread();
  } else {
    // Only load threads list if no current thread
    await loadThreadsList();
  }
}

function showTitleEditForm() {
  // Only allow editing if we have a current thread
  if (!currentModel || !currentThreadId) {
    showToast("No conversation selected to rename", "error");
    return;
  }

  // Get the current title
  const titleElement = document.getElementById("current-thread-title");
  const currentTitle = titleElement.textContent || "New Conversation";

  // Hide the title and edit button
  titleElement.style.display = "none";
  editTitleBtn.style.display = "none";

  // Create the edit form
  const titleContainer = document.getElementById("thread-title-container");
  const editForm = document.createElement("div");
  editForm.className = "title-edit-container";
  editForm.innerHTML = `
    <input type="text" id="title-input" value="${currentTitle}" placeholder="Enter conversation title">
    <button id="save-title-btn" class="btn">Save</button>
    <button id="cancel-title-btn" class="btn">Cancel</button>
  `;

  titleContainer.appendChild(editForm);

  // Focus the input
  const titleInput = document.getElementById("title-input");
  titleInput.focus();
  titleInput.select();

  // Add event listeners for the buttons
  document
    .getElementById("save-title-btn")
    .addEventListener("click", saveTitle);
  document
    .getElementById("cancel-title-btn")
    .addEventListener("click", cancelTitleEdit);

  // Also save on Enter key
  titleInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      saveTitle();
    } else if (event.key === "Escape") {
      cancelTitleEdit();
    }
  });
}

function cancelTitleEdit() {
  // Remove the edit form
  const titleContainer = document.getElementById("thread-title-container");
  const editForm = titleContainer.querySelector(".title-edit-container");
  if (editForm) {
    titleContainer.removeChild(editForm);
  }

  // Show the title and edit button again
  document.getElementById("current-thread-title").style.display = "";
  editTitleBtn.style.display = "";
}

async function saveTitle() {
  const titleInput = document.getElementById("title-input");
  const newTitle = titleInput.value.trim();

  if (!newTitle) {
    showToast("Title cannot be empty", "error");
    return;
  }

  try {
    // Show loading state
    const saveBtn = document.getElementById("save-title-btn");
    // const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    // Only proceed if we have a Claude model
    if (!(currentModel instanceof ClaudeWebModel)) {
      showToast(
        "Title editing is only supported for Claude conversations",
        "error"
      );
      cancelTitleEdit();
      return;
    }

    // Call the editTitle method
    await currentModel.editTitle(newTitle);

    // Update the title in the UI
    updateThreadTitle(newTitle);

    // Update the thread in memory if available
    if (currentModel.currentThread) {
      currentModel.currentThread.title = newTitle;
    }

    // Show success message
    showToast("Title updated successfully", "info");

    // Remove the edit form
    cancelTitleEdit();
  } catch (error) {
    console.error("Error updating title:", error);
    showToast(`Failed to update title: ${getErrorMessage(error)}`, "error");
  }
}

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

    // // Show/hide edit and share buttons based on model type
    // if (currentModel instanceof ClaudeWebModel) {
    //   editTitleBtn.style.display = "";
    //   shareConversationBtn.style.display = "";
    // } else {
    // Always hide edit and share buttons for new threads
    editTitleBtn.style.display = "none";
    shareConversationBtn.style.display = "none";
    deleteConversationBtn.style.display = "none";
    // }

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

async function loadClaudeStyles() {
  try {
    if (!currentModel || !(currentModel instanceof ClaudeWebModel)) {
      return;
    }

    const stylesData = await currentModel.getStyles();
    if (!stylesData) {
      console.error("Failed to get Claude styles");
      return;
    }

    // Store styles globally
    claudeStyles = stylesData;

    // Clear existing options except the default
    // claudeStyleSelect.innerHTML = '<option value="Default">Default</option>';

    // Add default styles
    if (stylesData.defaultStyles && Array.isArray(stylesData.defaultStyles)) {
      stylesData.defaultStyles.forEach((style) => {
        const option = document.createElement("option");
        option.value = style.key;
        option.textContent = style.name;
        claudeStyleSelect.appendChild(option);
      });
    }

    // Add custom styles if any
    if (stylesData.customStyles && Array.isArray(stylesData.customStyles)) {
      // Add a separator if we have both default and custom styles
      if (stylesData.defaultStyles && stylesData.defaultStyles.length > 0) {
        const separator = document.createElement("option");
        separator.disabled = true;
        separator.textContent = "──────────";
        claudeStyleSelect.appendChild(separator);
      }

      stylesData.customStyles.forEach((style) => {
        const option = document.createElement("option");
        option.value = style.key;
        option.textContent = style.name;
        claudeStyleSelect.appendChild(option);
      });
    }

    // Restore previously selected style if available
    chrome.storage.local.get(["claudeStyleKey"], (result) => {
      if (result.claudeStyleKey) {
        // Check if the style still exists
        const styleExists = Array.from(claudeStyleSelect.options).some(
          (option) => option.value === result.claudeStyleKey
        );

        if (styleExists) {
          claudeStyleSelect.value = result.claudeStyleKey;
          currentStyleKey = result.claudeStyleKey;
        }
      }
    });
  } catch (error) {
    console.error("Error loading Claude styles:", error);
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
    chatContainer.innerHTML = `<div class="message error-message">Error: ${error.message}</div>`;
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

  // Show edit and share buttons only for Claude model
  if (currentModel instanceof ClaudeWebModel && messages && messages.length >= 2) {
    editTitleBtn.style.display = "";
    shareConversationBtn.style.display = "";
    deleteConversationBtn.style.display = "";
  } else {
    editTitleBtn.style.display = "none";
    shareConversationBtn.style.display = "none";
    deleteConversationBtn.style.display = "none";
  }

  if (messages && messages.length > 0) {
    messages.forEach((message) => {
      const messageElement = document.createElement("div");
      messageElement.className = `message ${
        message.role === "user" ? "user-message" : "assistant-message"
      }`;

      // Check if this message has an image
      if (
        message.role === "user" &&
        (message.metadata?.imageDataUrl || message.metadata?.imageUrl)
      ) {
        // Create HTML with image and text - use dataUrl if available, otherwise fall back to imageUrl
        const imageSource =
          message.metadata.imageDataUrl || message.metadata.imageUrl;
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
      if (
        message.role === "assistant" &&
        message.metadata?.suggestedResponses
      ) {
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

// In the sendMessage function, add proper error handling
async function sendMessage() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  try {
    // Disable send button and show loading state
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span>';

    // Create model if not already created
    if (!currentModel) {
      currentModel = createModel();
    }

    // Create a new thread if needed
    if (!currentThreadId) {
      await createNewThread(false);
    }

    // Display user message
    const userMessageElement = document.createElement("div");
    userMessageElement.className = "message user-message";

    // If there's an image, display it with the message
    if (selectedImage) {
      const imageUrl = URL.createObjectURL(selectedImage);
      userMessageElement.innerHTML = `
        <div class="message-image-container">
          <img src="${imageUrl}" alt="User uploaded image" class="message-image">
        </div>
        <div class="message-text">${promptInput.value}</div>
      `;
    } else {
      userMessageElement.textContent = promptInput.value;
    }

    chatContainer.appendChild(userMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Create assistant message placeholder
    const assistantMessageElement = document.createElement("div");
    assistantMessageElement.className = "message assistant-message";
    // assistantMessageElement.innerHTML =
    //   '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    assistantMessageElement.innerHTML =
      '<div class="loading">Thinking...</div>';
    chatContainer.appendChild(assistantMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;


    promptInput.value = "";

    // Clear image preview and selection
    if (selectedImage) {
      imagePreview.innerHTML = "";
      imagePreview.classList.add("hidden");
    }

    console.log("Sending message to model:", prompt);
    console.log("Current model type:", currentModel.getName());

    // Get the Bing mode if applicable
    let bingMode = undefined;
    if (
      modelSelect.value === "bing" &&
      !bingModeToggle.classList.contains("hidden")
    ) {
      const modeSelect = document.getElementById("bing-mode-select");
      if (modeSelect) {
        bingMode = modeSelect.value;
        console.log("Using Bing mode:", bingMode);
      }
    }

    console.log(currentStyleKey);

    await currentModel.sendMessage(prompt, {
      image: selectedImage,
      signal: null, // TODO: Implement abort signal
      mode: bingMode,
      style_key: currentStyleKey,
      onEvent: (event) => {
        const assistantMsgCont = document.querySelector(
          ".message.assistant-message:last-of-type"
        );
        switch (event.type) {
          case "UPDATE_ANSWER":
            if (assistantMsgCont.classList.contains("hidden"))
              assistantMsgCont.classList.remove("hidden");
            assistantMessageElement.innerHTML =
              event.data.text ||
              '<div class="typing-indicator"><span></span><span></span><span></span></div>';
            chatContainer.scrollTop = chatContainer.scrollHeight;
            break;
          case "ERROR":
            // Display error message in the assistant message element
            if (!assistantMsgCont.classList.contains("hidden"))
              assistantMsgCont.classList.add("hidden");
            const errorMessageElement = document.createElement("div");
            errorMessageElement.className = "message error-message";
            errorMessageElement.textContent = `Error: ${event.error.message}`;
            chatContainer.scrollTop = chatContainer.scrollHeight;

            // Re-enable send button
            sendButton.disabled = false;
            sendButton.textContent = "Send";
            break;
          case "DONE":
            // Re-enable send button
            sendButton.disabled = false;
            sendButton.textContent = "Send";

            // Reset selected image
            selectedImage = null;

            // Show edit and share buttons if we have at least 2 messages now
            if (
              currentModel instanceof ClaudeWebModel &&
              currentModel.currentThread &&
              currentModel.currentThread.messages &&
              currentModel.currentThread.messages.length >= 2
            ) {
              editTitleBtn.style.display = "";
              shareConversationBtn.style.display = "";
              deleteConversationBtn.style.display = "";
            }

            break;
          case "TITLE_UPDATE":
            updateThreadTitle(event.data.title);
            break;
          case "SUGGESTED_RESPONSES":
            if (event.data.suggestions && event.data.suggestions.length > 0) {
              displaySuggestedResponses(event.data.suggestions);
            }
            break;
        }
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);

    // Display error in chat
    const errorElement = document.createElement("div");
    errorElement.className = "message error-message";
    errorElement.textContent = `Error: ${
      error.message || "Unknown error occurred"
    }`;
    chatContainer.appendChild(errorElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Re-enable send button
    sendButton.disabled = false;
    sendButton.textContent = "Send";
  }
}

// Helper function to update an assistant message with new content
function updateAssistantMessage(messageElement, text) {
  // Convert markdown to HTML if needed
  const formattedText = text
    .replace(/\n/g, "<br>")
    .replace(/```(\w+)?\n([\s\S]*?)\n```/g, "<pre><code>$2</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // Update the message content
  // const contentElement = messageElement.querySelector(".message-content");
  // if (contentElement) {
  //   contentElement.innerHTML = formattedText;
  // }

  if (messageElement) {
    messageElement.innerHTML = formattedText;
  }

  // Scroll to the bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
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
      titleElement.textContent =
        thread.title ||
        `Conversation ${new Date(thread.createdAt).toLocaleString()}`;
      threadItem.appendChild(titleElement);

      // Create date element with friendly time format
      const dateElement = document.createElement("div");
      dateElement.className = "thread-date";
      dateElement.textContent = `Last updated: ${formatRelativeTime(
        thread.updatedAt
      )}`;
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
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  // For updates within 5 hours
  if (diffInHours < 5) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  }

  // Format the time string
  const timeString = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
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
    const weekdayName = date.toLocaleDateString(undefined, { weekday: "long" });
    return `${weekdayName}, at ${timeString}`;
  }

  // For older updates
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${formattedDate}, at ${timeString}`;
}

// Create a model instance based on the selected model
function createModel() {
  const modelType = modelSelect.value;
  const apiKey = apiKeyInput?.value || "";

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
      // Create Claude model and load styles
      const claudeModel = new ClaudeWebModel();

      // Load styles after model is created
      setTimeout(async () => await loadClaudeStyles(), 500);

      return claudeModel;

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
// function getErrorMessage(error) {
//   if (!error) return "Unknown error occurred";

//   if (error.code) {
//     switch (error.code) {
//       case ErrorCode.UNAUTHORIZED:
//         return "Authentication failed. Check your API key or session cookies.";
//       case ErrorCode.SERVICE_UNAVAILABLE:
//         return "The AI service is currently unavailable.";
//       case ErrorCode.MISSING_API_KEY:
//         return "API key is required but not provided.";
//       case ErrorCode.INVALID_REQUEST:
//         return "Invalid request. Please check your input.";
//       default:
//         return `Error: ${error.message || "Unknown error"}`;
//     }
//   }

//   return error.message || "Unknown error occurred";
// }

function getErrorMessage(error) {
  if (error instanceof AIModelError) {
    return error.message;
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return String(error);
  }
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
    "What would you like to explore today?",
  ];

  const randomMessage =
    welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
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

  console.log("Displaying suggested responses:", suggestions);

  const suggestionsContainer = document.createElement("div");
  suggestionsContainer.className = "suggestions-container";

  suggestions.forEach((suggestion) => {
    const suggestionBtn = document.createElement("button");
    suggestionBtn.className = "suggestion-btn";
    suggestionBtn.textContent = suggestion;
    suggestionBtn.addEventListener("click", () => {
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

async function shareConversation() {
  // Only allow sharing if we have a current thread
  if (!currentModel || !currentThreadId) {
    showToast("No conversation selected to share", "error");
    return;
  }

  // Only proceed if we have a Claude model
  if (!(currentModel instanceof ClaudeWebModel)) {
    showToast("Sharing is only supported for Claude conversations", "error");
    return;
  }

  try {
    // Show loading state
    const originalText = shareConversationBtn.innerHTML;
    shareConversationBtn.innerHTML = "⏳";
    shareConversationBtn.disabled = true;

    // Call the shareConversation method
    const shareUrl = await currentModel.shareConversation();

    // Show success message with the URL
    showShareSuccessDialog(shareUrl);

    // Reset button state
    shareConversationBtn.innerHTML = originalText;
    shareConversationBtn.disabled = false;
  } catch (error) {
    console.error("Error sharing conversation:", error);
    showToast(
      `Failed to share conversation: ${getErrorMessage(error)}`,
      "error"
    );

    // Reset button state
    shareConversationBtn.innerHTML = "🔗";
    shareConversationBtn.disabled = false;
  }
}

// Function to show a dialog with the share URL
function showShareSuccessDialog(shareUrl) {
  // Create modal container
  const modalContainer = document.createElement("div");
  modalContainer.className = "modal-container";
  modalContainer.style.position = "fixed";
  modalContainer.style.top = "0";
  modalContainer.style.left = "0";
  modalContainer.style.width = "100%";
  modalContainer.style.height = "100%";
  modalContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modalContainer.style.display = "flex";
  modalContainer.style.justifyContent = "center";
  modalContainer.style.alignItems = "center";
  modalContainer.style.zIndex = "1000";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.backgroundColor = "white";
  modalContent.style.padding = "20px";
  modalContent.style.borderRadius = "8px";
  modalContent.style.maxWidth = "90%";
  modalContent.style.width = "400px";
  modalContent.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";

  // Create modal header
  const modalHeader = document.createElement("div");
  modalHeader.className = "modal-header";
  modalHeader.style.display = "flex";
  modalHeader.style.justifyContent = "space-between";
  modalHeader.style.alignItems = "center";
  modalHeader.style.marginBottom = "15px";

  const modalTitle = document.createElement("h3");
  modalTitle.textContent = "Conversation Shared!";
  modalTitle.style.margin = "0";

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "24px";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 5px";
  closeButton.onclick = () => document.body.removeChild(modalContainer);

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeButton);

  // Create modal body
  const modalBody = document.createElement("div");
  modalBody.className = "modal-body";

  const shareMessage = document.createElement("p");
  shareMessage.textContent =
    "Your conversation has been shared. Anyone with this link can view it:";

  const urlContainer = document.createElement("div");
  urlContainer.style.display = "flex";
  urlContainer.style.marginBottom = "15px";
  urlContainer.style.marginTop = "15px";

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.value = shareUrl;
  urlInput.readOnly = true;
  urlInput.style.flexGrow = "1";
  urlInput.style.padding = "8px";
  urlInput.style.border = "1px solid #ccc";
  urlInput.style.borderRadius = "4px 0 0 4px";

  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy";
  copyButton.className = "btn";
  copyButton.style.borderRadius = "0 4px 4px 0";
  copyButton.style.margin = "0";
  copyButton.onclick = () => {
    urlInput.select();
    document.execCommand("copy");
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 2000);
  };

  urlContainer.appendChild(urlInput);
  urlContainer.appendChild(copyButton);

  const openButton = document.createElement("button");
  openButton.textContent = "Open in Browser";
  openButton.className = "btn";
  openButton.style.width = "100%";
  openButton.style.marginTop = "10px";
  openButton.onclick = () => {
    window.open(shareUrl, "_blank");
  };

  modalBody.appendChild(shareMessage);
  modalBody.appendChild(urlContainer);
  modalBody.appendChild(openButton);

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContainer.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalContainer);
}

// Function to show a confirmation dialog before deleting
function confirmDeleteConversation() {
  // Only allow deleting if we have a current thread
  if (!currentModel || !currentThreadId) {
    showToast("No conversation selected to delete", "error");
    return;
  }

  // Only proceed if we have a Claude model
  if (!(currentModel instanceof ClaudeWebModel)) {
    showToast("Deletion is only supported for Claude conversations", "error");
    return;
  }

  // Create modal container
  const modalContainer = document.createElement("div");
  modalContainer.className = "modal-container";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.maxWidth = "350px";

  // Create modal header
  const modalHeader = document.createElement("div");
  modalHeader.className = "modal-header";

  const modalTitle = document.createElement("h3");
  modalTitle.textContent = "Delete Conversation";
  modalTitle.style.color = "#d32f2f";

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "24px";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 5px";
  closeButton.onclick = () => document.body.removeChild(modalContainer);

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeButton);

  // Create modal body
  const modalBody = document.createElement("div");
  modalBody.className = "modal-body";

  const deleteMessage = document.createElement("p");
  deleteMessage.textContent = "Are you sure you want to delete this conversation? This action cannot be undone.";
  
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "flex-end";
  buttonContainer.style.marginTop = "20px";
  buttonContainer.style.gap = "10px";
  
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.className = "btn";
  cancelButton.style.backgroundColor = "#9e9e9e";
  cancelButton.onclick = () => document.body.removeChild(modalContainer);
  
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete";
  deleteButton.className = "btn";
  deleteButton.style.backgroundColor = "#d32f2f";
  deleteButton.onclick = () => {
    document.body.removeChild(modalContainer);
    deleteConversation();
  };
  
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(deleteButton);

  modalBody.appendChild(deleteMessage);
  modalBody.appendChild(buttonContainer);

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContainer.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalContainer);
}

// Function to actually delete the conversation
async function deleteConversation() {
  try {
    // Show loading state
    const originalText = deleteConversationBtn.innerHTML;
    deleteConversationBtn.innerHTML = "⏳";
    deleteConversationBtn.disabled = true;

    // Get the metadata from the current thread
    if (!currentModel.currentThread || !currentModel.currentThread.metadata) {
      throw new Error("No thread metadata available");
    }

    const metadata = currentModel.currentThread.metadata;
    if (!metadata.organizationId || !metadata.conversationId) {
      throw new Error("Invalid thread metadata");
    }

    // Call the deleteServerThread method
    await currentModel.deleteServerThread([metadata.conversationId], true);

    // Show success message
    showToast("Conversation deleted successfully", "info");

    // Reset current thread and create a new one
    currentThreadId = null;
    await chrome.storage.local.remove(["currentThreadId"]);
    await createNewThread(false);

    // Reset button state
    deleteConversationBtn.innerHTML = originalText;
    deleteConversationBtn.disabled = false;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showToast(`Failed to delete conversation: ${getErrorMessage(error)}`, "error");
    
    // Reset button state
    deleteConversationBtn.innerHTML = "🗑️";
    deleteConversationBtn.disabled = false;
  }
}


// Initialize the UI when the popup is loaded
document.addEventListener("DOMContentLoaded", initUI);
