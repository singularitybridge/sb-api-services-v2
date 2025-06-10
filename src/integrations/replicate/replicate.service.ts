import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { uploadFile } from '../../services/google.storage.service';

interface ReplicatePredictionOptions {
  model: string;
  input: Record<string, any>;
  filename?: string;
}

const POLLING_CONFIG = {
  maxWaitTime: 90000,      // 90 seconds max wait
  initialInterval: 1000,   // Start checking after 1 second
  maxInterval: 5000,       // Max 5 seconds between checks
  backoffMultiplier: 1.5   // Exponential backoff
};

export const createPrediction = async (
  companyId: string,
  model: string,
  input: Record<string, any>
): Promise<any> => {
  const apiKey = await getApiKey(companyId, 'replicate_api_key');
  if (!apiKey) {
    throw new Error('Replicate API key not found');
  }

  console.log(`[ReplicateService] Creating prediction for model: ${model}`);
  try {
    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: model, // The model string itself (e.g., "owner/name" or "owner/name:version_id")
        input,
      },
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`[ReplicateService] Prediction created successfully. ID: ${response.data.id}`);
    return response.data;
  } catch (error: any) {
    console.error('[ReplicateService] Error creating Replicate prediction:', error.response?.data || error.message);
    throw new Error(`Failed to create Replicate prediction: ${error.response?.data?.detail || error.message}`);
  }
};

export const getPredictionStatus = async (companyId: string, predictionId: string): Promise<any> => {
  const apiKey = await getApiKey(companyId, 'replicate_api_key');
  if (!apiKey) {
    throw new Error('Replicate API key not found');
  }

  // console.log(`[ReplicateService] Getting prediction status for ID: ${predictionId}`); // Too noisy for polling
  try {
    const response = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      }
    );
    // console.log(`[ReplicateService] Status for ${predictionId}: ${response.data.status}`); // Too noisy
    return response.data;
  } catch (error: any) {
    console.error(`[ReplicateService] Error getting Replicate prediction status for ID ${predictionId}:`, error.response?.data || error.message);
    throw new Error(`Failed to get Replicate prediction status: ${error.response?.data?.detail || error.message}`);
  }
};

export const waitForPrediction = async (companyId: string, predictionId: string): Promise<any> => {
  let status = '';
  let output = null;
  let error = null;
  let elapsedTime = 0;
  let interval = POLLING_CONFIG.initialInterval;

  console.log(`[ReplicateService] Starting to wait for prediction ID: ${predictionId}. Max wait: ${POLLING_CONFIG.maxWaitTime}ms`);

  while (status !== 'succeeded' && status !== 'failed' && elapsedTime < POLLING_CONFIG.maxWaitTime) {
    console.log(`[ReplicateService] Polling for ${predictionId}. Elapsed: ${elapsedTime}ms. Interval: ${interval}ms. Status: ${status || 'initial'}`);
    const prediction = await getPredictionStatus(companyId, predictionId);
    status = prediction.status;
    console.log(`[ReplicateService] Polled ${predictionId}. Current status: ${status}`);
    output = prediction.output;
    error = prediction.error;

    if (status === 'succeeded') {
      console.log(`[ReplicateService] Prediction ${predictionId} succeeded.`);
      return output;
    } else if (status === 'failed') {
      console.error(`[ReplicateService] Prediction ${predictionId} failed. Error: ${error}`);
      throw new Error(`Replicate prediction failed: ${error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
    elapsedTime += interval;
    interval = Math.min(interval * POLLING_CONFIG.backoffMultiplier, POLLING_CONFIG.maxInterval);
  }

  if (status !== 'succeeded') {
    console.warn(`[ReplicateService] Prediction ${predictionId} timed out or did not succeed after ${elapsedTime}ms. Final status: ${status}`);
    throw new Error('Replicate prediction timed out or did not succeed.');
  }
  return output;
};

export const downloadAndUploadImage = async (
  imageUrl: string,
  filename?: string
): Promise<string> => {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    let determinedContentType = response.headers['content-type']?.toLowerCase();
    let determinedExtension = '';
    let finalFileName = '';

    const commonImageExtensions: { [key: string]: string } = {
      'jpeg': 'image/jpeg', 'jpg': 'image/jpeg', 'png': 'image/png', 
      'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml'
    };

    if (filename) {
      const nameParts = filename.split('.');
      const ext = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() : undefined;
      if (ext && commonImageExtensions[ext]) {
        determinedExtension = ext;
        // If header content type is generic or missing, use one derived from filename extension
        if (!determinedContentType || determinedContentType === 'application/octet-stream') {
          determinedContentType = commonImageExtensions[ext];
        }
        finalFileName = filename; // Use provided filename as is
      }
    }

    if (!determinedContentType || determinedContentType === 'application/octet-stream') {
      // If still octet-stream, default to png or try to guess from URL if desperate
      // For now, let's stick to a safe default if header is missing and filename didn't help
      determinedContentType = 'image/png'; // A safer default than octet-stream for images
      determinedExtension = 'png';
    } else if (!determinedExtension) {
      // Try to get extension from a valid content type
      const typeParts = determinedContentType.split('/');
      if (typeParts[0] === 'image' && typeParts[1]) {
        determinedExtension = typeParts[1].split('+')[0]; // Handles svg+xml -> svg
      } else {
        determinedExtension = 'png'; // Fallback
        if (determinedContentType !== 'image/png') determinedContentType = 'image/png'; // Correct if inconsistent
      }
    }
    
    if (!finalFileName) {
      finalFileName = filename 
        ? (filename.endsWith('.' + determinedExtension) ? filename : `${filename}.${determinedExtension}`) 
        : `replicate_image_${Date.now()}.${determinedExtension}`;
    }
    // Ensure finalFileName doesn't end with .octet-stream if we have a better extension
    if (finalFileName.endsWith('.octet-stream') && determinedExtension !== 'octet-stream') {
        finalFileName = finalFileName.replace('.octet-stream', `.${determinedExtension}`);
    }


    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: finalFileName, // Use the refined filename
      encoding: '7bit',
      mimetype: determinedContentType, // Use the refined content type
      buffer: imageBuffer,
      size: imageBuffer.length,
    };
    console.log(`[ReplicateService] Uploading to GCS. OriginalName: ${file.originalname}, MimeType: ${file.mimetype}`);
    const publicUrl = await uploadFile(file as Express.Multer.File);
    return publicUrl;
  } catch (error: any) {
    console.error('Error downloading or uploading image:', error.message);
    throw new Error(`Failed to download or upload image: ${error.message}`);
  }
};

export const runReplicateModel = async (
  companyId: string,
  options: ReplicatePredictionOptions
): Promise<any> => {
  const { model, input, filename } = options;

  try {
    const prediction = await createPrediction(companyId, model, input);
    const output = await waitForPrediction(companyId, prediction.id);

    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string' && output[0].startsWith('http')) {
      // Assume it's an image URL if it's an array of strings starting with http
      const imageUrl = output[0];
      return await downloadAndUploadImage(imageUrl, filename);
    } else if (typeof output === 'string' && output.startsWith('http')) {
      // Single image URL
      return await downloadAndUploadImage(output, filename);
    } else {
      // Other types of output (text, JSON, etc.)
      return output;
    }
  } catch (error: any) {
    console.error('Error running Replicate model:', error.message);
    throw new Error(`Failed to run Replicate model: ${error.message}`);
  }
};
