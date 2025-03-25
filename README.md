# AI Models Bridge

A TypeScript library that provides a unified interface for interacting with various AI models in browser extensions and web applications.

## 🚧 Work in Progress

This project is currently under active development. Features and APIs may change without notice. This README, documentation, and installation instructions are also a work in progress.

## 📋 Overview

AI Models Bridge is a library that allows developers to easily integrate multiple AI models into their browser extensions or web applications. It provides a consistent API for interacting with different AI services, handling the complexity of different authentication methods, request formats, and response parsing.

## 🧩 Project Structure

The project consists of two main parts:

1. **Library**: A TypeScript library that provides a unified API for interacting with various AI models
2. **Demo Extension**: A browser extension that demonstrates how the library can be used

## 🤖 Supported AI Models (Not all are stable)

- ChatGPT API
- Google Gemini Web (Bard)
- Claude Web
- OpenRouter
- Gemini API
- Baichuan Web

## 🚀 Getting Started

### For Library Users

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