import fs from 'fs';
import https from 'https';
import path from 'path';

/**
 * Downloads a file from a URL to a local path
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Clean up on error
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Clean up on error
      reject(err);
    });
  });
}

/**
 * Deletes a file from the filesystem
 */
export async function deleteFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        // Ignore "file not found" errors
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Ensures a directory exists, creates it if it doesn't
 */
export async function ensureDir(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirPath, { recursive: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Gets the temp directory path for voice files
 */
export function getTempDir(): string {
  return process.env.TEMP_DIR || '/tmp';
}

/**
 * Generates a unique temporary file path
 */
export function getTempFilePath(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const filename = `${prefix}_${timestamp}_${random}.${extension}`;
  return path.join(getTempDir(), filename);
}
