#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const sourceDir = path.join(rootDir, 'dist', 'public');
const targetDir = path.join(rootDir, 'client', 'dist');

console.log('Post-build: Copying frontend assets...');
console.log(`From: ${sourceDir}`);
console.log(`To: ${targetDir}`);

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(sourceDir)) {
    // Ensure target directory exists
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    // Remove target if it exists
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    // Copy all files
    copyRecursive(sourceDir, targetDir);
    console.log('✓ Frontend assets copied successfully');
  } else {
    console.error(`Error: Source directory ${sourceDir} does not exist`);
    process.exit(1);
  }
} catch (error) {
  console.error('Error during post-build:', error);
  process.exit(1);
}
