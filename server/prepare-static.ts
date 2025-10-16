// server/prepare-static.js
import fs from 'fs';
import path from 'path';

export async function prepareStaticFiles() {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const sourceDir = path.join(rootDir, 'dist', 'public');
  const targetDir = path.join(rootDir, 'client', 'dist');

  console.log('[STATIC] Preparing frontend assets...');
  console.log(`[STATIC] Source: ${sourceDir}`);
  console.log(`[STATIC] Target: ${targetDir}`);

  try {
    // Check if source exists
    if (!fs.existsSync(sourceDir)) {
      console.error(`[STATIC] ERROR: Source directory ${sourceDir} does not exist`);
      console.error('[STATIC] Build artifacts not found. Deployment may fail.');
      return;
    }

    // Ensure client directory exists
    const clientDir = path.join(rootDir, 'client');
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
      console.log('[STATIC] Created client directory');
    }

    // Remove existing target if it exists
    if (fs.existsSync(targetDir)) {
      const stats = fs.lstatSync(targetDir);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(targetDir);
        console.log('[STATIC] Removed existing symlink');
      } else {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log('[STATIC] Removed existing directory');
      }
    }

    // Try to create symlink first (faster)
    try {
      fs.symlinkSync(sourceDir, targetDir, 'dir');
      console.log('[STATIC] ✓ Created symlink client/dist -> dist/public');
    } catch (symlinkError) {
      // Fallback to copying if symlink fails
      console.log('[STATIC] Symlink failed, copying files instead...');
      
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
      console.log('[STATIC] ✓ Files copied successfully');
    }
    
    console.log('[STATIC] Frontend assets ready for serving');
  } catch (error) {
    console.error('[STATIC] ERROR during preparation:', error);
    throw error;
  }
}
