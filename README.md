# AI Models Bridge

A TypeScript library that provides a unified interface for interacting with various AI models in browser extensions and web applications.

## 🚧 Work in Progress

This project is currently under active development. Features and APIs may change without notice. This README, documentation, and installation instructions are also a work in progress.

## 📋 Overview

AI Models Bridge is a library that allows developers to easily integrate multiple AI models into their browser extensions or web applications. It provides a consistent API for interacting with different AI services, handling the complexity of different authentication methods, request formats, and response parsing.

## 🧩 Project Structure

The project consists of two main parts:

1. **Library**: The Typescript library itself, that provides a unified interface for interacting with various AI models
2. **Demo Extension**: A browser extension that demonstrates how the library can be used

## 🤖 Supported AI Models and Implementation Status

### 📊 Implementation Readiness Levels

The following classification system is used to indicate the implementation status of each AI model and identify which features are available for each one.

| Level | Name                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1    | Basic Text Support                   | Basic implementation with text-only conversation support. Authentication* and core messaging functionality work, but may have limitations.                                                                                                                                                                                                                                                                                                                                |
| L2    | Thread Handling Support              | Support for conversation history, thread and message management, and conversation state persistence.                                                                                                                                                                                                                                                                                                                                                                      |
| L3    | Image Support*                       | Support for images in conversations. Includes proper handling of image uploads and saving and returning data for display/usage.                                                                                                                                                                                                                                                                                                                                           |
| L4    | Model Specific Features              | Support for model-specific features like suggested responses, different conversation modes (chat, reasoning, etc.), and streaming responses*.                                                                                                                                                                                                                                                                                                                             |
| L5    | Improved Error Handling              | Slightly improved error handling for AI models.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| L6    | Multimedia Support                   | Support for images_and_ other media types in conversations*. Includes mostly proper handling of media uploads and saving and returning data for display/usage.                                                                                                                                                                                                                                                                                                            |
| L7    | Enhanced Text Formatting and Support | Improved text handling with support for different model output styles & formats (widgets, code, markdown, tables, etc.). Includes proper rendering and parsing of formatted outputs.                                                                                                                                                                                                                                                                                      |
| L8    | Advanced Features                    | Advanced features like dynamic model switching*, comprehensive implementation of model-specific capabilities, etc.                                                                                                                                                                                                                                                                                                                                                        |
| L9    | Beta Testing/Usage Ready             | Implementation ready for testing. Includes and requires comprehensive error handling, rate limiting and quota handling support, proper documentation and testing framework, security measures, caching, extensive unit and integration tests (possibly), detailed performance monitoring and logging for testing, cross-browser compatibility verification, preliminary security audits, final optimizations and extensive real-world testing across different scenarios. |
| L10   | Production Ready (Stable)            | Fully tested implementation with comprehensive error handling, rate limiting support, proper documentation, robust security measures, and optimized performance. Ready for production use.                                                                                                                                                                                                                                                                                |

*if supported by the AI model

### 🎯 Current Model Implementation Status

| Model                       | Status | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Implemented Models                                                                                                                                                                                          |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Gemini Web (Bard)    | L6     | Text and image support (other file types not supported by model) with conversation history and thread management. Basic error handling implemented. Server operation utility methods, like deleting, sharing, renaming conversations, etc. Response Streaming not supported by model.                                                                                                                                                                                                                                                         | 2.0 Flash                                                                                                                                                                                                   |
| Copilot Web (Bing Chat)     | L5     | Supports text and image inputs. Implements conversation modes (chat, reasoning). Has automatic thread title generation, suggested replies, and response streaming. Thread management and conversation history functional. Still requires improved error handling and reconnection logic.                                                                                                                                                                                                                                                      | Default (based on GPT-4, GPT-4o and GPT-o3-mini)                                                                                                                                                            |
| Claude Web (Claude)         | L5     | Supports text and image inputs. Supports automatic and manual thread title generation, response streaming, and Claude specific conversation/response styles. Has a lot of other server operation utility methods, like deleting, sharing, renaming conversations, etc. Thread management and conversation history functional. Still requires somewhat improved error handling and reconnection logic, and support of other models.                                                                                                            | 3.7 Sonnet                                                                                                                                                                                                  |
| Perplexity Web (Perplexity) | L6     | Supports text and image, and other attachment/file inputs. Supports automatic thread title generation, response streaming, and Perplexity specific search focus and sources. Also supports model switching. Server operation utility methods, like deleting, sharing, renaming conversations, etc. Thread management and conversation history functional. Has improved error handling, but still requires better reconnection logic, etc.                                                                                                   | Perplexity Sonar, Perplexity Pro Auto, Perplexity Sonar Pro, GPT-4.1, Claude 3.7 Sonnet, Gemini 2.5 Pro, Grok 3 Beta, Perplexity R1 1776, GPT-o4-mini, Claude 3.7 Sonnet Thinking, Perplexity Deep Research |
| Deepseek Web (Deepseek)     | L6     | Supports text and image (only for text extraction, due to model limitations), and other attachment/file inputs. File attachments are only supported when web-search is off, due to model limitations. Supports automatic thread title generation, response streaming, web-search support, and model switching. Server operation utility methods, like deleting, sharing, renaming conversations, etc. Thread management and conversation history functional. Has improved error handling, but still requires better reconnection logic, etc. | Deepseek Chat V3 0324, Deepseek R1                                                                                                                                                                          |

## 🚀 Getting Started (section still in progress, not ready yet)

### For Library Users

You can include the bundled library in your browser extension's HTML file:

```html
<script src="path/to/ai-models-bridge.min.js"></script>
<script>
  // import the models from the library
  const { BardModel, BingModel } = window.AIModelsBridge;
  // The above can also be used in a separate js file instead of the inline script tag, as long as the script tag for the separate js file is AFTER the ai-models-bridge script tag (since the models are imported from the window object).
  // Example usage for the gemini web model is given below
</script>
```

#### Example Usage for Gemini Web Model

```typescript
import { BardModel } from 'ai-models-bridge';

// Initialize the Bard/Gemini Web model (no API key required, but need to be logged in to Gemini in the browser)
const model = new BardModel();

// Create a new conversation thread
await model.initNewThread();

// Send a message and get a response
await model.sendMessage('Hello, how are you?', {
  onProgress: (text) => {
    console.log('Partial response:', text);
  }
});

// Access the conversation history
const messages = model.currentThread.messages;

// You can also send images (if supported by the model)
// Example of creating a File object from an input element
const fileInput = document.getElementById('imageInput') as HTMLInputElement;
const imageFile = fileInput.files?.[0]; // Get the first selected file

// Or create a File object programmatically
// const imageFile = new File([imageBlob], "image.jpg", { type: "image/jpeg" });

await model.sendMessage('What is in this image?', {
  image: imageFile,
  onProgress: (text) => {
    console.log('Analyzing image:', text);
  }
});

```

## 📦 Installation (section still in progress, not ready yet)

To install the AI Models Bridge library and test it, download the source code and run the following command in your terminal in the 'Demo_extension' folder to build the library:

```bash
npm run dev
```

This will install necessary dependencies and build the library, creating 2 'dist' folders with the compiled files (for the library and the demo extension).

Then, load the 'Demo_extension' folder in your browser as an unpacked extension. After this, you can test the library by clicking on the extension icon and interacting with the popup.

---

Created with ❤️ by Sukarth Acharya
