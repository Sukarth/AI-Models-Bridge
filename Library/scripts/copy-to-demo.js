import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create lib directory in demo extension if it doesn't exist
const libDir = path.resolve(__dirname, '../../Demo_extension/lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Copy the bundled files
const bundledFiles = ['ai-models-bridge.min.js', 'ai-models-bridge.min.js.map', 'ai-models-bridge.esm.js', 'ai-models-bridge.esm.js.map'];
bundledFiles.forEach(file => {
  const sourcePath = path.resolve(__dirname, '../dist', file);
  const destPath = path.resolve(libDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to Demo_extension/lib/`);
  } else {
    console.error(`Source file not found: ${sourcePath}`);
  }
});