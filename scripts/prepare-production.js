#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const sourceDir = path.join(rootDir, 'dist', 'public');
const targetDir = path.join(rootDir, 'client', 'dist');

console.log('Preparing production environment...');
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);

try {
  // Check if source exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist`);
    console.error('Please run the build command first');
    process.exit(1);
  }

  // Ensure client directory exists
  const clientDir = path.join(rootDir, 'client');
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }

  // Remove existing target if it exists
  if (fs.existsSync(targetDir)) {
    // Check if it's a symlink
    const stats = fs.lstatSync(targetDir);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(targetDir);
      console.log('Removed existing symlink');
    } else {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log('Removed existing directory');
    }
  }

  // Create symlink
  fs.symlinkSync(sourceDir, targetDir, 'dir');
  console.log('✓ Created symlink from client/dist -> dist/public');
  console.log('✓ Production environment ready');
} catch (error) {
  console.error('Error during preparation:', error);
  
  // Fallback: try copying instead of symlinking
  console.log('Attempting to copy files instead of creating symlink...');
  try {
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
    
    copyRecursive(sourceDir, targetDir);
    console.log('✓ Files copied successfully');
  } catch (copyError) {
    console.error('Copy also failed:', copyError);
    process.exit(1);
  }
}
