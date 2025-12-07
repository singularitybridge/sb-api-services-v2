import axios, { AxiosError } from 'axios';
import sharp from 'sharp';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TARGET_SIZE = 512; // Resize images to 512x512 for team avatars

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const downloadFile = async (
  url: string,
  retries = MAX_RETRIES,
): Promise<Buffer> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      // Important: Don't let axios encode the URL further
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept any status < 500
      timeout: 30000, // 30 second timeout
    });

    if (response.status >= 400) {
      // Try to decode error response
      const errorText = Buffer.from(response.data).toString('utf-8');
      console.error(
        `Download failed with status ${response.status}:`,
        errorText,
      );
      throw new Error(`Download failed with status ${response.status}`);
    }

    return response.data;
  } catch (error) {
    // Check if it's a timeout or network error that can be retried
    const isRetryable =
      error instanceof AxiosError &&
      (error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout'));

    if (isRetryable && retries > 0) {
      console.log(
        `Download timeout, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`,
      );
      await sleep(RETRY_DELAY_MS);
      return downloadFile(url, retries - 1);
    }

    if (error instanceof AxiosError && error.response?.data) {
      // Log the actual error response from S3
      const errorText = Buffer.from(error.response.data).toString('utf-8');
      console.error(`S3 Error Response:`, errorText);
    }
    console.error(`Error downloading file from URL: ${url}`, error);
    throw error; // Re-throw the error so it can be caught by the calling service
  }
};

/**
 * Download and compress an image to reduce file size
 * @param url - URL to download image from
 * @param targetSize - Target width/height in pixels (default: 512)
 * @param quality - JPEG quality 0-100 (default: 85)
 */
export const downloadAndCompressImage = async (
  url: string,
  targetSize: number = TARGET_SIZE,
  quality: number = 85,
): Promise<Buffer> => {
  const originalBuffer = await downloadFile(url);
  const originalSize = originalBuffer.length;

  console.log(
    `Compressing image from ${(originalSize / 1024 / 1024).toFixed(2)}MB...`,
  );

  // Resize and compress the image
  const compressedBuffer = await sharp(originalBuffer)
    .resize(targetSize, targetSize, {
      fit: 'cover', // Crop to fit if aspect ratio differs
      position: 'center',
    })
    .jpeg({ quality, mozjpeg: true }) // Use mozjpeg for better compression
    .toBuffer();

  const compressedSize = compressedBuffer.length;
  const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  console.log(
    `Compressed to ${(compressedSize / 1024).toFixed(0)}KB (${reduction}% reduction)`,
  );

  return compressedBuffer;
};
