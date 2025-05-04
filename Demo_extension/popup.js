const {
  GeminiWebModel,
  BingWebModel,
  ClaudeWebModel,
  PerplexityWebModel,
  DeepseekWebModel, // <-- Add DeepseekWebModel import
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
const imagePreview = document.getElementById("image-preview");
const bingModeToggle = document.createElement("div");
const deepseekToggles = document.createElement("div"); // Add Deepseek search toggle
const claudeStylesContainer = document.getElementById(
  "claude-styles-container"
);
const claudeStyleSelect = document.getElementById("claude-style-select");
const editTitleBtn = document.getElementById("edit-title-btn");
const shareConversationBtn = document.createElement("button");
const threadTitleContainer = document.getElementById("thread-title-container");
const deleteConversationBtn = document.createElement("button");
const unshareConversationBtn = document.createElement("button");
const getConvoDataBtn = document.createElement("button"); // New button for Get Conversation Data
const perplexityOptionsContainer = document.getElementById(
  "perplexity-options-container"
);
const perplexityModelSelect = document.getElementById(
  "perplexity-model-select"
);
const perplexityFocusSelect = document.getElementById(
  "perplexity-focus-select"
);
const perplexitySourcesContainer = document.getElementById(
  "perplexity-sources-container"
);
const perplexitySourcesCheckboxes = document.getElementById(
  "perplexity-sources-checkboxes"
);

const fileUploadBtn = document.getElementById('file-upload-btn');

function updateFileInputAccept() {
  const model = modelSelect.value;
  if (model === 'gemini-web' || model === 'bing-web') {
    fileUploadBtn.setAttribute('accept', 'image/*');
  } else {
    fileUploadBtn.removeAttribute('accept'); // Allow any file
  }
}

modelSelect.addEventListener('change', updateFileInputAccept);
window.addEventListener('DOMContentLoaded', updateFileInputAccept);

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

unshareConversationBtn.className = "icon-btn";
unshareConversationBtn.id = "perplexity-private-btn";
unshareConversationBtn.title = "Make conversation private";
unshareConversationBtn.innerHTML = "🔒";
unshareConversationBtn.style.display = "none"; // Hide by default

getConvoDataBtn.id = "get-convo-data-btn";
getConvoDataBtn.className = "icon-btn";
getConvoDataBtn.title = "Get Conversation Data (Log to Console)";
getConvoDataBtn.innerHTML = "📊"; // Example icon
getConvoDataBtn.style.display = "none"; // Hide by default

if (threadTitleContainer) {
  threadTitleContainer.appendChild(shareConversationBtn);
  threadTitleContainer.appendChild(unshareConversationBtn);
  threadTitleContainer.appendChild(deleteConversationBtn);
  threadTitleContainer.appendChild(getConvoDataBtn); // Add the new button
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

deepseekToggles.id = "deepseek-toggles";
deepseekToggles.className = "hidden";
deepseekToggles.innerHTML = `
  <div class="deepseek-toggle-row" style="display: flex; gap: 16px; justify-content: space-between;">
    <div class="mode-toggle-container" style="flex:1;">
      <label class="mode-toggle" style="width:100%;">
        <span>Search:</span>
        <select id="deepseek-search-select" style="margin-left: 6px;">
          <option value="enabled" selected>Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <span class="mode-info" title="Enable or disable Deepseek's internet search features">ⓘ</span>
      </label>
    </div>
    <div class="mode-toggle-container" style="flex:1; text-align:right;">
      <label class="mode-toggle" style="width:100%;">
        <span>Mode:</span>
        <select id="deepseek-mode-select" style="margin-left: 6px;">
          <option value="chat" selected>Chat</option>
          <option value="reasoning">Reasoning</option>
        </select>
        <span class="mode-info" title="Chat is conversational, Reasoning is more analytical">ⓘ</span>
      </label>
    </div>
  </div>
`;

document.addEventListener("change", (event) => {
  if (event.target && event.target.id === "deepseek-mode-select") {
    chrome.storage.local.set({ deepseekMode: event.target.value });
  }
  if (event.target && event.target.id === "deepseek-search-select") {
    chrome.storage.local.set({ deepseekSearch: event.target.value });
  }
});

// --- Ensure old reasoning logic is removed ---
// Event listener for the old global #toggle-reasoning-btn (should be gone)
const inputContainer = document.querySelector(".input-container");
if (inputContainer) {
  inputContainer.insertBefore(
    bingModeToggle,
    document.querySelector(".button-container")
  );
  inputContainer.insertBefore(
    deepseekToggles,
    document.querySelector(".button-container")
  );
} else {
  // Fallback if input-container doesn't exist
  const promptContainer = promptInput.parentElement;
  if (promptContainer) {
    promptContainer.insertBefore(bingModeToggle, promptInput);
    promptContainer.insertBefore(deepseekToggles, promptInput);
  }
}

// Store the current model instance and selected image
let currentModel = null;
let selectedImages = []; // Changed from selectedImage = null
let currentThreadId = null;
let claudeStyles = [];
let selectedStyleKey = "";
let currentStyleKey = null;
let bingMode = null;
let perplexitySelectedModel = null;
let perplexitySelectedFocus = "internet"; // Default focus
let perplexitySelectedSources = ["web"]; // Default source


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
    let displayTitle = title || "New Conversation";
    let displayEmoji = "";

    // Check for Gemini and emoji in metadata
    if (
      currentModel instanceof GeminiWebModel &&
      currentModel.currentThread?.metadata?.emoji
    ) {
      displayEmoji = currentModel.currentThread.metadata.emoji;
      // Ensure title doesn't already have the emoji prepended from somewhere else
      if (displayTitle.startsWith(displayEmoji + " ")) {
        // Title already includes emoji, use as is
      } else {
        displayTitle = `${displayEmoji} ${displayTitle}`;
      }
    }

    threadTitleElement.textContent = displayTitle;

    // Show/hide title element based on whether a title exists (or it's the default)
    // And only show edit button if a real thread is loaded
    if (title && currentThreadId) {
      threadTitleElement.style.display = "";
      // Edit button visibility is handled by updateButtonVisibility
    } else {
      threadTitleElement.style.display = "none"; // Hide if no title (e.g., new thread)
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

  const { deepseekMode, deepseekSearch } = await chrome.storage.local.get([
    "deepseekMode",
    "deepseekSearch",
  ]);

  const modeSelect = document.getElementById("deepseek-mode-select");
  if (modeSelect && deepseekMode) {
    modeSelect.value = deepseekMode;
  }
  const searchSelect = document.getElementById("deepseek-search-select");
  if (searchSelect && deepseekSearch) {
    searchSelect.value = deepseekSearch;
  }

  await updateUI();

  // Add event listeners

  // Add event listener for Claude style selection
  claudeStyleSelect.addEventListener("change", async () => {
    currentStyleKey = claudeStyleSelect.value;
    await chrome.storage.local.set({ claudeStyleKey: currentStyleKey });
  });

  // Add event listeners for Perplexity options
  perplexityModelSelect.addEventListener("change", () => {
    perplexitySelectedModel = perplexityModelSelect.value;
    // Optionally save to storage if needed: await chrome.storage.local.set({ perplexityModel: perplexitySelectedModel });
  });

  // Use event delegation for source buttons
  perplexitySourcesCheckboxes.addEventListener("click", (event) => {
    const toggleLabel = event.target.closest(".toggle-switch-label");
    if (toggleLabel) {
      const checkbox = toggleLabel.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const source = checkbox.value;

        // Toggle checkbox state
        checkbox.checked = !checkbox.checked;

        if (checkbox.checked) {
          // Add to selected sources
          if (!perplexitySelectedSources.includes(source)) {
            perplexitySelectedSources.push(source);
          }
          // Add active class for styling
          toggleLabel.classList.add("active");
        } else {
          // Remove from selected sources
          perplexitySelectedSources = perplexitySelectedSources.filter(
            (s) => s !== source
          );
          // Remove active class
          toggleLabel.classList.remove("active");
        }

        // If no sources selected, writing mode is implied
        perplexitySelectedFocus =
          perplexitySelectedSources.length > 0 ? "internet" : "writing";

        // console.log("Selected Perplexity Sources:", perplexitySelectedSources);
        // console.log("Search Focus:", perplexitySelectedFocus);
      }
    }
  });

  apiKeyInput?.addEventListener("change", async () => {
    await chrome.storage.local.set({ apiKey: apiKeyInput.value });
  });

  modelSelect.addEventListener("change", updateUI);
  fileUploadBtn.addEventListener("change", handleFileUpload);
  sendButton.addEventListener("click", sendMessage);
  // Add event listener for toggling per-message reasoning sections using event delegation
  chatContainer.addEventListener('click', function (event) {
    const header = event.target.closest('.message-reasoning-header');
    if (header) {
      const container = header.closest('.message-reasoning-container');
      if (container) {
        container.classList.toggle('collapsed');
      }
    }
  });
  loadConversationsBtn.addEventListener("click", loadThreadsList);
  newThreadBtn.addEventListener("click", createNewThread);
  editTitleBtn.addEventListener("click", showTitleEditForm);
  shareConversationBtn.addEventListener("click", shareConversation);
  deleteConversationBtn.addEventListener("click", confirmDeleteConversation);
  unshareConversationBtn.addEventListener("click", unshareConversation);
  getConvoDataBtn.addEventListener(
    "click",
    getConversationDataForCurrentThread
  ); // Add listener for new button

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

  updateFileInputAccept();
}

// async function updateModelAndUIState() {
//   const selectedModel = modelSelect.value;
//   const apiKey = apiKeyInput?.value || "";

//   updateApiKeyContainer();
//   await chrome.storage.local.set({ selectedModel: selectedModel });
//   // Reset current model when changing model type
//   currentModel = null;
//   currentThreadId = null;
//   await chrome.storage.local.remove(["currentThreadId"]);
//   clearChatDisplay();

//   if (currentModel instanceof ClaudeWebModel) {
//     editTitleBtn.style.display = "";
//     shareConversationBtn.style.display = "";
//     deleteConversationBtn.style.display = "";
//   } else if (currentModel instanceof PerplexityWebModel) {
//     editTitleBtn.style.display = "";
//     shareConversationBtn.style.display = "";
//     deleteConversationBtn.style.display = "";
//     unshareConversationBtn.style.display = "";
//   } else {
//     editTitleBtn.style.display = "none";
//     shareConversationBtn.style.display = "none";
//     deleteConversationBtn.style.display = "none";
//     unshareConversationBtn.style.display = "none";
//   }

//   // Close conversations list if open
//   conversationsList.classList.add("hidden");
// }

// Function to update UI based on selected model
async function updateUI() {
  const selectedModel = modelSelect.value;

  await chrome.storage.local.set({ selectedModel: selectedModel });

  currentThreadId = null;
  await chrome.storage.local.remove(["currentThreadId"]);
  currentModel = createModel();

  conversationsList.classList.add("hidden");


  // Reset styles when changing models
  claudeStylesContainer.classList.add("hidden");
  bingModeToggle.classList.add("hidden");
  deepseekToggles.classList.add("hidden"); // Hide Deepseek toggle by default
  claudeStyleSelect.innerHTML = "";
  perplexityOptionsContainer.classList.add("hidden"); // Hide Perplexity options by default

  if (selectedModel === "claude-web") {
    apiKeyContainer.classList.add("hidden");
    claudeStylesContainer.classList.remove("hidden");
    if (currentModel) {
      loadClaudeStyles();
    }
  } else if (selectedModel === "bing-web") {
    apiKeyContainer.classList.add("hidden");
    bingModeToggle.classList.remove("hidden");
  } else if (selectedModel === "gemini-web") {
    apiKeyContainer.classList.add("hidden");
  } else if (selectedModel === "perplexity-web") {
    apiKeyContainer.classList.add("hidden");
    perplexityOptionsContainer.classList.remove("hidden");
    if (currentModel) {
      loadPerplexityOptions(); // Function to load models and sources
    } // Closes 'if (currentModel)'
  } else if (selectedModel === "deepseek-web") {
    apiKeyContainer.classList.add("hidden");
    deepseekToggles.classList.remove("hidden"); // Show Deepseek mode toggle
  } // <-- Add missing closing brace for 'else if (selectedModel === "perplexity-web")'


  // Reset model and thread state
  // currentModel = null; // Will be recreated by createModel() shortly if needed
  // currentThreadId = null;
  // await chrome.storage.local.remove(["currentThreadId"]);


  clearChatDisplay();
  updateThreadTitle(null); // Reset title when UI updates for a model change
  updateButtonVisibility(); // Update buttons for the new state (no thread)
}

// Function to manage visibility of action buttons based on model and thread state
function updateButtonVisibility() {
  console.log(
    "Updating button visibility. Model:",
    currentModel?.getName(),
    "Thread ID:",
    currentThreadId
  );

  // Default: Hide all buttons initially
  editTitleBtn.style.display = "none";
  shareConversationBtn.style.display = "none";
  deleteConversationBtn.style.display = "none";
  unshareConversationBtn.style.display = "none";
  getConvoDataBtn.style.display = "none";

  // Determine if a thread is loaded and has messages
  const isThreadLoaded = !!currentThreadId;
  const hasMessages =
    currentModel?.currentThread?.messages &&
    currentModel.currentThread.messages.length > 0;
  // Often buttons appear after the first exchange (2+ messages)
  const hasMultipleMessages =
    currentModel?.currentThread?.messages &&
    currentModel.currentThread.messages.length >= 2;

  console.log(
    `isThreadLoaded: ${isThreadLoaded}, hasMessages: ${hasMessages}, hasMultipleMessages: ${hasMultipleMessages}`
  );

  if (isThreadLoaded) {
    if (currentModel instanceof ClaudeWebModel) {
      editTitleBtn.style.display = hasMessages ? "" : "none"; // Show edit if thread exists
      shareConversationBtn.style.display = hasMultipleMessages ? "" : "none"; // Show share after first exchange
      deleteConversationBtn.style.display = hasMessages ? "" : "none"; // Show delete if thread exists
      getConvoDataBtn.style.display = hasMessages ? "" : "none"; // Show get data if thread exists for Claude
    } else if (currentModel instanceof PerplexityWebModel) {
      editTitleBtn.style.display = hasMessages ? "" : "none";
      shareConversationBtn.style.display = hasMultipleMessages ? "" : "none";
      deleteConversationBtn.style.display = hasMessages ? "" : "none";
      unshareConversationBtn.style.display = hasMultipleMessages ? "" : "none"; // Show unshare after first exchange
    } else if (currentModel instanceof GeminiWebModel) {
      editTitleBtn.style.display = hasMessages ? "" : "none"; // Show edit if thread exists
      shareConversationBtn.style.display = hasMultipleMessages ? "" : "none"; // Show share after first exchange for Gemini
      unshareConversationBtn.style.display = hasMultipleMessages ? "" : "none"; // Show unshare after first exchange for Gemini
      deleteConversationBtn.style.display = hasMessages ? "" : "none"; // Show delete if thread exists
      getConvoDataBtn.style.display = hasMessages ? "" : "none"; // Show get data if thread exists
    } else if (currentModel instanceof DeepseekWebModel) {
      // For Deepseek, enable local delete and get all conversations data
      deleteConversationBtn.style.display = hasMessages ? "" : "none"; // Local delete
      getConvoDataBtn.style.display = hasMessages ? "" : "none"; // Get all conversations
      // Edit title and share are not supported by the current implementation
      editTitleBtn.style.display = hasMessages ? "" : "none"; // Show edit if thread exists
      shareConversationBtn.style.display = "none";
      unshareConversationBtn.style.display = "none";
    }
  }

  // Log final visibility states
  console.log("Button Visibility:", {
    edit: editTitleBtn.style.display,
    share: shareConversationBtn.style.display,
    delete: deleteConversationBtn.style.display,
    unshare: unshareConversationBtn.style.display,
    getData: getConvoDataBtn.style.display,
  });
}

function showTitleEditForm() {
  // Only allow editing if we have a current thread
  if (!currentModel || !currentThreadId) {
    showToast("No conversation selected to rename", "error");
    return;
  }

  // Get the current title
  const titleElement = document.getElementById("current-thread-title");
  let currentTitle = titleElement.textContent || "New Conversation";

  // For Gemini, strip emoji from title if present
  if (
    currentModel instanceof GeminiWebModel &&
    currentModel.currentThread?.metadata?.emoji
  ) {
    const emoji = currentModel.currentThread.metadata.emoji;
    currentTitle = currentTitle.replace(`${emoji} `, "");
  }

  // Hide the title and edit button
  titleElement.style.display = "none";
  editTitleBtn.style.display = "none";

  // Explicitly hide other action buttons before showing the edit form
  shareConversationBtn.style.display = "none";
  deleteConversationBtn.style.display = "none";
  unshareConversationBtn.style.display = "none";
  getConvoDataBtn.style.display = "none";

  // Create the edit form
  const titleContainer = document.getElementById("thread-title-container");
  const editForm = document.createElement("div");
  editForm.className = "title-edit-container";

  // Base HTML for title input
  let formHTML = `
    <input type="text" id="title-input" value="${currentTitle}" placeholder="Enter conversation title" style="flex-grow: 1; margin-right: 5px;">
  `;

  // Add emoji input specifically for Gemini
  if (currentModel instanceof GeminiWebModel) {
    // Retrieve current emoji for placeholder/value
    const currentEmoji = currentModel.currentThread?.metadata?.emoji || "";
    formHTML += `
      <input type="text" id="emoji-input" value="${currentEmoji}" placeholder="Emoji" maxlength="2" style="width: 60px; margin-right: 5px; text-align: center;">
    `;
  }

  // Add save/cancel buttons
  formHTML += `
    <button id="save-title-btn" class="btn">Save</button>
    <button id="cancel-title-btn" class="btn">Cancel</button>
  `;

  editForm.innerHTML = formHTML;
  editForm.style.display = "flex"; // Use flexbox for alignment
  editForm.style.alignItems = "center";

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
  editTitleBtn.style.display = ""; // Re-show edit button specifically

  // Restore visibility of other buttons using the central function
  updateButtonVisibility();
}

async function saveTitle() {
  const titleInput = document.getElementById("title-input");
  const newTitle = titleInput.value.trim();

  if (!newTitle) {
    showToast("Title cannot be empty", "error");
    return;
  }

  // Show loading state
  const saveBtn = document.getElementById("save-title-btn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  try {
    // Handle title editing for supported models
    if (
      currentModel instanceof ClaudeWebModel ||
      currentModel instanceof PerplexityWebModel ||
      currentModel instanceof DeepseekWebModel
    ) {
      await currentModel.editTitle(newTitle);
    } else if (currentModel instanceof GeminiWebModel) {
      const emojiInput = document.getElementById("emoji-input");
      const emoji = emojiInput ? emojiInput.value.trim() : undefined;
      await currentModel.editTitle(newTitle, emoji); // Pass emoji to Gemini's method

      // // Store emoji in thread metadata if available
      // if (currentModel.currentThread && emoji) {
      //   if (!currentModel.currentThread.metadata) {
      //     currentModel.currentThread.metadata = {};
      //   }
      //   currentModel.currentThread.metadata.emoji = emoji;
      // }
    } else {
      showToast("Title editing is not supported for this model.", "error");
      // Reset button state
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      cancelTitleEdit();
      return;
    }

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

    // Reset button state on error
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

async function createNewThread(showNotification = true) {
  try {
    console.log("Creating new thread...", showNotification);
    // Close conversations list if open
    conversationsList.classList.add("hidden");
    console.log("eeeeeeeeeeeee:", currentModel);

    if (!currentModel) {
      currentModel = createModel();
    }

    await currentModel.initNewThread();

    console.log("New thread created:", currentModel);

    if (currentModel.currentThread) {
      if (currentModel instanceof DeepseekWebModel) {
        currentThreadId = currentModel.currentThread.metadata?.conversationId || currentModel.currentThread.id;
      } else {
        currentThreadId = currentModel.currentThread.id;
      }
      await chrome.storage.local.set({ currentThreadId });
      updateThreadTitle(null); // Set title to default for new thread
    } else {
      updateThreadTitle(null); // Ensure title is reset even if thread creation failed internally
    }

    clearChatDisplay();
    updateButtonVisibility(); // Update buttons for the new thread state

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
      const option = document.createElement("option");
      option.disabled = true;
      option.textContent = "───Styles───";
      claudeStyleSelect.appendChild(option);
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
  // Update title (including potential Gemini emoji)
  updateThreadTitle(currentModel.currentThread.title);

  const messages = currentModel.currentThread.messages;

  // Update button visibility based on loaded thread state
  updateButtonVisibility();

  if (messages && messages.length > 0) {
    messages.forEach((message, index) => { // Add index
      const messageElement = document.createElement("div");
      messageElement.className = `message ${message.role === "user" ? "user-message" : "assistant-message"}`;
      messageElement.dataset.messageIndex = index; // Optional ID

      // === Render Assistant Message with potential Reasoning ===
      if (message.role === 'assistant') {
        // --- Reasoning Section ---
        if (message.reasoningContent) {
          const reasoningContainer = document.createElement('div');
          // Unique ID for targeting during updates
          reasoningContainer.id = `reasoning-${message.id || index}`;
          reasoningContainer.className = 'message-reasoning-container collapsed'; // Start collapsed

          const reasoningTime = message.metadata?.reasoningTimeSecs;
          const timeText = reasoningTime ? `Thought for ${reasoningTime} second${reasoningTime === 1 ? '' : 's'}` : 'Thinking Process';

          reasoningContainer.innerHTML = `
               <div class="message-reasoning-header">
                 <span class="thought-icon">🧠</span>
                 <span>${timeText}</span>
                 <span class="toggle-icon">▼</span>
               </div>
               <div class="message-reasoning-content">
                 ${message.reasoningContent}
               </div>
              `;
          // Prepend reasoning container to the message element
          messageElement.appendChild(reasoningContainer);
        }

        // --- Main Content Section ---
        const textContentDiv = document.createElement('div');
        textContentDiv.className = 'message-text-content';
        // Use innerHTML to render potential markdown/formatting later if needed
        textContentDiv.innerHTML = message.content;
        messageElement.appendChild(textContentDiv);

        // === Render User Message (handling images) ===
      } else if (message.role === 'user') {
        if (message.metadata?.imageDataUrl || message.metadata?.imageUrl) {
          const imageSource = message.metadata.imageDataUrl || message.metadata.imageUrl;
          messageElement.innerHTML = `
              <div class="message-image-container">
                <img src="${imageSource}" alt="User uploaded image" class="message-image" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';">
              </div>
              <div class="message-text-content">${message.content}</div>
            `;
        } else {
          // Simple text message for user
          const textContentDiv = document.createElement('div');
          textContentDiv.className = 'message-text-content';
          textContentDiv.textContent = message.content;
          messageElement.appendChild(textContentDiv);
        }
      } else {
        // Fallback for system messages or other roles
        const textContentDiv = document.createElement('div');
        textContentDiv.className = 'message-text-content';
        textContentDiv.textContent = message.content;
        messageElement.appendChild(textContentDiv);
      }

      chatContainer.appendChild(messageElement); // Add the complete message element

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

function updateThumbnails() {
  // Clear the preview area
  imagePreview.innerHTML = "";
  if (selectedImages.length === 0) {
    fileUploadBtn.value = "";
    imagePreview.classList.add("hidden");
    return;
  }
  imagePreview.classList.remove("hidden");

  selectedImages.forEach((file, index) => {
    const previewContainer = document.createElement("div");
    previewContainer.className = "image-preview-item";
    let contentHTML = "";

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        contentHTML = `
        <img src="${e.target.result}" alt="Selected image ${index + 1}" class="preview-image">
        <div class="file-preview-name">${file.name}</div>
        `;
        renderPreview();
      };
      reader.readAsDataURL(file);
    } else {
      contentHTML = `
        <div class="file-preview-icon">📄</div>
        <div class="file-preview-name">${file.name}</div>
      `;
      renderPreview();
    }

    function renderPreview() {
      previewContainer.innerHTML = `
        ${contentHTML}
        <button class="remove-btn" data-index="${index}" title="Remove file">&times;</button>
      `;
      // Attach remove event and re-render on removal
      previewContainer.querySelector(".remove-btn").onclick = () => {
        selectedImages.splice(index, 1);
        updateThumbnails();
      };
    }

    imagePreview.appendChild(previewContainer);
  });
}

// Handle file upload (multiple files, max 4)
function handleFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  let currentCount = selectedImages.length;
  const filesToAdd = Array.from(files);

  if (currentCount + filesToAdd.length > 4) {
    showToast("Maximum of 4 files allowed.", "error");
    fileUploadBtn.value = "";
    return;
  }

  const model = modelSelect.value;
  const onlyImages = model === "gemini-web" || model === "bing-web";

  filesToAdd.forEach((file) => {
    if (onlyImages && !file.type.startsWith("image/")) {
      showToast(`File "${file.name}" is not an image.`, "error");
      return;
    }
    selectedImages.push(file);
  });

  updateThumbnails();


  // For Deepseek, if attachments exist then disable search
  if (model === "deepseek-web") {
    const searchSelect = document.getElementById("deepseek-search-select");
    if (selectedImages.length > 0 && searchSelect) {
      searchSelect.disabled = true;
      showToast("Attachments are enabled – disabling search.", "info");
    } else if (searchSelect) {
      searchSelect.disabled = false;
    }
  }

  // Also, listen to changes on Deepseek search select:
  const deepseekSearchSelect = document.getElementById("deepseek-search-select");
  if (deepseekSearchSelect) {
    deepseekSearchSelect.addEventListener("change", (event) => {
      // If the user enables search while attachments exist, warn and clear attachments.
      const selected = deepseekSearchSelect.value;
      if (selected === "enabled" && selectedImages.length > 0) {
        showToast("You can't enable search when attachments are added. Clearing attachments.", "error");
        selectedImages = [];
        updateThumbnails();
        // Optionally, clear file input as well:
        fileUploadBtn.value = "";
      }
    });
  }

}

// In the sendMessage function, add proper error handling
async function sendMessage() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  try {
    // Disable send button and show loading state
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span>Sending...';

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

    // Display user message with potential images
    let userMessageHTML = `<div class="message-text">${promptInput.value}</div>`; // Ensure text is always present
    if (selectedImages.length > 0) {
      let imagePreviewsHTML = '<div class="message-image-container">'; // Container for image previews
      selectedImages.forEach((imgFile, index) => {
        const objectURL = URL.createObjectURL(imgFile); // Create temporary URL for preview
        imagePreviewsHTML += `<img src="${objectURL}" alt="User uploaded image ${index + 1
          }" class="message-image">`;
        // Consider revoking objectURL later: URL.revokeObjectURL(objectURL);
      });
      imagePreviewsHTML += "</div>";
      // Prepend the image container to the message text
      userMessageHTML = imagePreviewsHTML + userMessageHTML;
    }
    userMessageElement.innerHTML = userMessageHTML; // Set the combined HTML

    chatContainer.appendChild(userMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Create assistant message placeholder with a dedicated content area
    const assistantMessageElement = document.createElement("div");
    assistantMessageElement.className = "message assistant-message";
    // Add a specific inner element for the text content to avoid replacing the whole message on updates
    assistantMessageElement.innerHTML =
      '<div class="message-text-content"><div class="loading">Thinking...</div></div>';
    chatContainer.appendChild(assistantMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    promptInput.value = "";

    // Clear image preview and selection state *before* sending
    imagePreview.innerHTML = "";
    imagePreview.classList.add("hidden");
    const imagesToUpload = [...selectedImages]; // Copy the array to pass to sendMessage
    selectedImages = []; // Clear the state array
    fileUploadBtn.value = ""; // Clear the file input visually

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

    // --- Prepare options for sendMessage ---
    const messageOptions = {
      images: imagesToUpload, // Pass the copied array of selected images
      signal: null, // TODO: Implement abort signal
      mode: bingMode, // For Bing
      style_key: currentStyleKey, // For Claude
      model: undefined, // For Perplexity
      searchFocus: undefined, // For Perplexity
      searchSources: undefined, // For Perplexity
      onEvent: (event) => {
        const assistantMsgCont = document.querySelector(
          ".message.assistant-message:last-of-type"
        );
        switch (event.type) {
          case "UPDATE_ANSWER":
            console.log("Assistant message update:", event.data);
            // Ensure the message container exists before accessing classList or innerHTML
            if (assistantMsgCont) {
              if (assistantMsgCont.classList.contains("hidden")) {
                assistantMsgCont.classList.remove("hidden");
              }
            }
            // Target the specific inner div ONLY for text content update
            const textContentDiv = assistantMsgCont?.querySelector('.message-text-content');
            if (textContentDiv) {
              textContentDiv.innerHTML =
                event.data.text || // Update only the text part
                '<div class="loading">Thinking...</div>'; // Show thinking if text is empty
            } else if (assistantMsgCont) {
              // Fallback: If the inner div isn't found, update the whole element (less ideal)
              console.warn("Could not find .message-text-content to update.");
              assistantMsgCont.innerHTML =
                event.data.text || '<div class="loading">Thinking...</div>';
            }

            responseDiv.scrollTop = responseDiv.scrollHeight;

            // --- Live Reasoning Container Update ---
            if (event.data.reasoningContent !== undefined) {
              // Find the last assistant message element
              if (assistantMsgCont) {
                let reasoningContainer = assistantMsgCont.querySelector('.message-reasoning-container');
                // Try to get reasoning time from event or from the last message metadata
                let reasoningTime = event.data.reasoningElapsedSecs;
                // If not present in event, try to get from the last message metadata
                // if (!reasoningTime && currentModel?.currentThread?.messages?.length) {
                //   const lastMsg = currentModel.currentThread.messages[currentModel.currentThread.messages.length - 1];
                //   reasoningTime = lastMsg?.metadata?.reasoningTimeSecs || lastMsg?.metadata?.reasoningElapsedSecs;
                // }
                const timeText = reasoningTime
                  ? `Thought for ${reasoningTime} second${reasoningTime === 1 ? '' : 's'}`
                  : 'Reasoning...';

                if (!reasoningContainer && event.data.reasoningContent.trim()) {
                  // Create and prepend if not present and content is non-empty
                  reasoningContainer = document.createElement('div');
                  reasoningContainer.className = 'message-reasoning-container collapsed';
                  reasoningContainer.innerHTML = `
                    <div class="message-reasoning-header">
                      <span class="thought-icon">🧠</span>
                      <span>${timeText}</span>
                      <span class="toggle-icon">▼</span>
                    </div>
                    <div class="message-reasoning-content">${event.data.reasoningContent.trimStart()}</div>
                  `;
                  assistantMsgCont.prepend(reasoningContainer);
                } else if (reasoningContainer) {
                  // Update content if already present
                  const contentDiv = reasoningContainer.querySelector('.message-reasoning-content');
                  if (contentDiv) contentDiv.innerHTML = event.data.reasoningContent;
                  // Update the header text if reasoningTimeSecs is present
                  const headerSpan = reasoningContainer.querySelector('.message-reasoning-header span:nth-child(2)');
                  if (headerSpan) headerSpan.textContent = timeText;
                  // If reasoning has ended, un-collapse and highlight
                  if (reasoningTime) {
                    reasoningContainer.classList.remove('collapsed');
                  }
                  reasoningContainer.scrollTop = reasoningContainer.scrollHeight;
                }
              }
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
            responseDiv.scrollTop = responseDiv.scrollHeight;
            break;

          case "ERROR":
            // Find the last assistant message element
            const lastAssistantMessage = document.querySelector(
              ".message.assistant-message:last-of-type"
            );
            // Hide it if it exists and isn't already hidden
            if (
              lastAssistantMessage &&
              !lastAssistantMessage.classList.contains("hidden")
            ) {
              lastAssistantMessage.classList.add("hidden");
            }
            // Create and append error message element
            const errorDiv = document.createElement("div");
            errorDiv.className = "message error-message";
            errorDiv.textContent = `Error: ${event.error.message}`;
            // Ensure chatContainer exists before appending
            if (chatContainer) {
              chatContainer.appendChild(errorDiv); // Use the correct variable name 'errorDiv'
              chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
              console.error("Chat container not found during error handling.");
            }

            // Re-enable send button (ensure sendButton exists)
            if (sendButton) {
              sendButton.disabled = false;
              sendButton.textContent = "Send";
            } else {
              console.error("Send button not found during error handling.");
            }
            break;

          case "DONE":
            // Re-enable send button
            sendButton.disabled = false;
            sendButton.textContent = "Send";

            // Reset selected images array (already cleared before send, but ensure it's empty)
            selectedImages = [];

            // Update button visibility now that the message exchange is complete
            updateButtonVisibility();

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
    };

    // Add Perplexity specific options if applicable
    if (currentModel instanceof PerplexityWebModel) {
      messageOptions.model =
        perplexitySelectedModel || currentModel.defaultModel; // Use selected or default

      // If any sources are selected, use internet focus, otherwise use writing focus
      perplexitySelectedFocus =
        perplexitySelectedSources.length > 0 ? "internet" : "writing";
      messageOptions.searchFocus = perplexitySelectedFocus;

      // Only send sources if we have any selected
      messageOptions.searchSources =
        perplexitySelectedSources.length > 0
          ? perplexitySelectedSources
          : undefined;

      console.log("Sending Perplexity Options:", {
        model: messageOptions.model,
        searchFocus: messageOptions.searchFocus,
        searchSources: messageOptions.searchSources,
      });
    }

    // Add Deepseek specific options if applicable
    if (currentModel instanceof DeepseekWebModel) {
      // Get mode (from Deepseek mode select)
      let deepseekMode = "chat";
      const modeSelect = document.getElementById("deepseek-mode-select");
      if (modeSelect) {
        deepseekMode = modeSelect.value;
      }
      // Get search enabled/disabled
      let searchEnabled = false;
      const searchSelect = document.getElementById("deepseek-search-select");
      if (searchSelect) {
        searchEnabled = searchSelect.value === "enabled";
      }
      messageOptions.mode = deepseekMode;
      messageOptions.searchEnabled = searchEnabled;
    }
    // --- End Prepare options ---

    await currentModel.sendMessage(prompt, messageOptions);

    const deepseekSearchSelect = document.getElementById("deepseek-search-select");
    if (deepseekSearchSelect) {
      deepseekSearchSelect.disabled = false;
    }


  } catch (error) {
    console.error("Error sending message:", error);

    // Display error in chat
    const errorElement = document.createElement("div");
    errorElement.className = "message error-message";
    errorElement.textContent = `Error: ${error.message || "Unknown error occurred"
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
    conversationsList.classList.add("hidden");

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
  console.log(modelType);
  const apiKey = apiKeyInput?.value || "";

  switch (modelType) {
    // case "chatgpt":
    //   if (!apiKey) throw new Error("API key is required for ChatGPT");
    //   return new window.AIModelsBridge.ChatGPTApiModel({
    //     apiKey,
    //     model: "gpt-3.5-turbo",
    //   });

    case "gemini-web":
      return new GeminiWebModel();

    case "bing-web":
      return new BingWebModel();

    case "claude-web":
      // Create Claude model and load styles
      const claudeModel = new ClaudeWebModel();

      // Load styles after model is created
      setTimeout(async () => await loadClaudeStyles(), 500);

      return claudeModel;

    case "perplexity-web":
      // Create Perplexity model and load options
      const perplexityModel = new PerplexityWebModel();
      // Load options after model is created and UI is potentially visible
      setTimeout(async () => await loadPerplexityOptions(), 0); // Use timeout to ensure UI elements are ready
      return perplexityModel;

    case "deepseek-web": // <-- Add case for Deepseek Web
      return new DeepseekWebModel();

    // case "openrouter":
    //   const modelName =
    //     document.getElementById("model-name")?.value || "anthropic/claude-2";
    //   return new window.AIModelsBridge.OpenRouterModel({
    //     apiKey,
    //     model: modelName,
    //   });

    // case "gemini":
    //   return new window.AIModelsBridge.GeminiApiModel({
    //     apiKey,
    //   });

    // case "baichuan":
    //   return new window.AIModelsBridge.BaichuanWebModel();

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

  // Only proceed if we have a Claude or Perplexity model
  if (
    !(currentModel instanceof ClaudeWebModel) &&
    !(currentModel instanceof PerplexityWebModel) &&
    !(currentModel instanceof GeminiWebModel)
  ) {
    showToast(
      "Sharing is only supported for Claude, Gemini and Perplexity conversations",
      "error"
    );
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

  // Adjust message based on model capabilities
  let confirmationMessage =
    "Are you sure you want to delete this conversation (this will only remove it locally)? This action cannot be undone.";
  if (
    !(currentModel instanceof ClaudeWebModel) &&
    !(currentModel instanceof PerplexityWebModel) &&
    !(currentModel instanceof GeminiWebModel)
  ) {
    confirmationMessage =
      "Are you sure you want to delete this conversation? This action cannot be undone. This will remove it locally and from the AI model servers.";
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
  deleteMessage.textContent = confirmationMessage; // Use the adjusted message

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

    // Check if the model supports server-side deletion
    if (typeof currentModel.deleteServerThreads === "function") {

      await currentModel.deleteServerThreads(
        [currentModel.currentThread.metadata.conversationId],
        true, // updateLocalThread
        false // createNewThreadAfterDelete
      );
      showToast("Conversation deleted successfully (Server & Local)", "info");
    } else {
      // For models without server deletion, just delete locally
      await currentModel.deleteThread(currentThreadId, false); // Delete locally, don't create new automatically
      showToast("Conversation deleted successfully (Local Only)", "info");
    }

    // Show success message
    // showToast("Conversation deleted successfully", "info");

    // Reset current thread ID
    currentThreadId = null;
    await chrome.storage.local.remove(["currentThreadId"]);

    // Explicitly create a new thread since we disabled automatic creation
    await createNewThread(false);

    // Update UI with the new thread
    if (currentModel.currentThread) {
      currentThreadId = currentModel.currentThread.id;
      await chrome.storage.local.set({ currentThreadId });
      updateThreadTitle(currentModel.currentThread.title);
    }

    // Reset button state
    deleteConversationBtn.innerHTML = originalText;
    deleteConversationBtn.disabled = false;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showToast(
      `Failed to delete conversation: ${getErrorMessage(error)}`,
      "error"
    );

    // Reset button state
    deleteConversationBtn.innerHTML = "🗑️";
    deleteConversationBtn.disabled = false;
  }
}

async function unshareConversation() {
  // Only allow if we have a current thread
  if (!currentModel || !currentThreadId) {
    showToast("No conversation selected", "error");
    return;
  }

  // Only proceed if we have a Perplexity model
  if (!(currentModel instanceof PerplexityWebModel) && !(currentModel instanceof GeminiWebModel)) {
    showToast(
      "This operation is only supported for Perplexity and Gemini conversations",
      "error"
    );
    return;
  }

  try {
    // Show loading state
    const originalText = unshareConversationBtn.innerHTML;
    unshareConversationBtn.innerHTML = "⏳";
    unshareConversationBtn.disabled = true;

    // Call the setThreadPrivate method
    const success = await currentModel.unShareConversation();

    if (success) {
      showToast("Conversation set to private", "info");
    } else {
      showToast("Failed to set conversation to private", "error");
    }

    // Reset button state
    unshareConversationBtn.innerHTML = originalText;
    unshareConversationBtn.disabled = false;
  } catch (error) {
    console.error("Error setting conversation to private:", error);
    showToast(
      `Failed to set conversation to private: ${getErrorMessage(error)}`,
      "error"
    );

    // Reset button state
    unshareConversationBtn.innerHTML = "🔒";
    unshareConversationBtn.disabled = false;
  }
}

// Function to load Perplexity models and sources into the UI
function loadPerplexityOptions() {
  if (!currentModel || !(currentModel instanceof PerplexityWebModel)) {
    return;
  }

  try {
    // --- Populate Models ---
    const models = currentModel.getModels(); // Assuming getModels() returns the structure from the class
    perplexityModelSelect.innerHTML = ""; // Clear existing options
    for (const modelName in models) {
      const option = document.createElement("option");
      option.value = modelName; // Use the user-friendly name as the value
      option.textContent = modelName;
      perplexityModelSelect.appendChild(option);
    }
    // Set default or previously selected model
    perplexityModelSelect.value =
      perplexitySelectedModel || currentModel.defaultModel;
    perplexitySelectedModel = perplexityModelSelect.value; // Update state

    // --- Populate Sources ---
    const sources = currentModel.getSearchSources();
    perplexitySourcesCheckboxes.innerHTML = ""; // Clear existing buttons

    // Create a wrapper for better styling
    const sourcesWrapper = document.createElement("div");
    sourcesWrapper.className = "sources-wrapper";
    perplexitySourcesCheckboxes.appendChild(sourcesWrapper);

    sources.forEach((source) => {
      const label = document.createElement("label");
      label.className = "toggle-switch-label";
      if (perplexitySelectedSources.includes(source)) {
        label.classList.add("active");
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = source;
      checkbox.id = `source-${source}`;
      checkbox.checked = perplexitySelectedSources.includes(source); // Check based on current state

      // Set the label text (capitalized source name)
      label.textContent = source.charAt(0).toUpperCase() + source.slice(1);

      // Add the hidden checkbox
      label.appendChild(checkbox);

      sourcesWrapper.appendChild(label);
    });

    // Set initial focus based on selected sources
    perplexitySelectedFocus =
      perplexitySelectedSources.length > 0 ? "internet" : "writing";
  } catch (error) {
    console.error("Error loading Perplexity options:", error);
    showToast("Failed to load Perplexity options", "error");
  }
}

// Initialize the UI when the popup is loaded
document.addEventListener("DOMContentLoaded", initUI);

// Function to get conversation data for the current thread (Gemini specific for now)
async function getConversationDataForCurrentThread() {


  // Check if the current model supports getting conversation data
  if (!(currentModel instanceof GeminiWebModel) && !(currentModel instanceof ClaudeWebModel) && !(currentModel instanceof DeepseekWebModel)) {
    showToast("Model not supported for getting conversation data.", "error");
    return;
  }

  if (!currentModel || !currentThreadId) {
    showToast("Please select a conversation first.", "error");
    return;
  }

  // Show loading state before the try block
  const originalText = getConvoDataBtn.innerHTML;
  getConvoDataBtn.innerHTML = "⏳";
  getConvoDataBtn.disabled = true;

  try {
    let data;
    console.log(`Fetching conversation data for thread: ${currentThreadId} using model: ${currentModel.getName()}`);
    if (currentModel instanceof DeepseekWebModel) {
      // For Deepseek, call getAllConversationsData as it's the most relevant implemented method
      data = await currentModel.getAllConversationsData();
      console.log("Deepseek All Conversations Data Received:", data);
    } else {
      // For Gemini/Claude, assume getConversationData exists (as per original code)
      data = await currentModel.getConversationData();
      console.log("Conversation Data Received:", data);
    }


    console.log("Conversation Data Received:", data); // Log the final data object
    showToast("Conversation data logged to console.", "info");

    getConvoDataBtn.innerHTML = originalText;
    getConvoDataBtn.disabled = false;
  } catch (error) {
    console.error("Error getting conversation data:", error);
    showToast(
      `Failed to get conversation data: ${getErrorMessage(error)}`,
      "error"
    );

    getConvoDataBtn.innerHTML = "📊";
    getConvoDataBtn.disabled = false;
  }
}