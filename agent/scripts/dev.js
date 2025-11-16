#!/usr/bin/env node

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4111;
let mastraProcess = null;
let restartTimeout = null;

// Clean up function
function killPort() {
  try {
    execSync(`lsof -t -i :${PORT} | xargs kill -9`, { stdio: 'ignore' });
  } catch (e) {
    // Port is already free
  }
}

// Start mastra dev
function startServer() {
  killPort();

  console.log(`\n🚀 Starting Mastra dev server on port ${PORT}...\n`);

  mastraProcess = spawn('mastra', ['dev'], {
    stdio: 'inherit',
    shell: true,
  });

  mastraProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Server exited with code ${code}`);
    }
  });
}

// Watch for file changes and restart
function setupWatcher() {
  const srcDir = path.join(__dirname, '../src');

  fs.watch(srcDir, { recursive: true }, (_eventType, filename) => {
    // Ignore certain files
    if (!filename || filename.includes('node_modules') || filename.includes('.map')) {
      return;
    }

    console.log(`\n📝 File changed: ${filename}`);
    console.log('🔄 Restarting server...\n');

    // Kill the old process
    if (mastraProcess) {
      try {
        mastraProcess.kill('SIGTERM');
      } catch (e) {
        // Process already dead
      }
    }

    // Debounce rapid file changes
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      startServer();
    }, 1000);
  });
}

// Start server
startServer();
setupWatcher();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  if (mastraProcess) {
    mastraProcess.kill('SIGTERM');
  }
  killPort();
  process.exit(0);
});
