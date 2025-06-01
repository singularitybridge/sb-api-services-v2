import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { uploadFile } from '../../services/google.storage.service';

interface ReplicatePredictionOptions {
  model: string;
  input: Record<string, any>;
  filename?: string;
}

const POLLING_CONFIG = {
  maxWaitTime: 600000,     // 10 minutes max wait
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
    return response.data;
  } catch (error: any) {
    console.error('Error creating Replicate prediction:', error.response?.data || error.message);
    throw new Error(`Failed to create Replicate prediction: ${error.response?.data?.detail || error.message}`);
  }
};

export const getPredictionStatus = async (companyId: string, predictionId: string): Promise<any> => {
  const apiKey = await getApiKey(companyId, 'replicate_api_key');
  if (!apiKey) {
    throw new Error('Replicate API key not found');
  }

  try {
    const response = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error getting Replicate prediction status:', error.response?.data || error.message);
    throw new Error(`Failed to get Replicate prediction status: ${error.response?.data?.detail || error.message}`);
  }
};

export const waitForPrediction = async (companyId: string, predictionId: string): Promise<any> => {
  let status = '';
  let output = null;
  let error = null;
  let elapsedTime = 0;
  let interval = POLLING_CONFIG.initialInterval;

  while (status !== 'succeeded' && status !== 'failed' && elapsedTime < POLLING_CONFIG.maxWaitTime) {
    const prediction = await getPredictionStatus(companyId, predictionId);
    status = prediction.status;
    output = prediction.output;
    error = prediction.error;

    if (status === 'succeeded') {
      return output;
    } else if (status === 'failed') {
      throw new Error(`Replicate prediction failed: ${error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
    elapsedTime += interval;
    interval = Math.min(interval * POLLING_CONFIG.backoffMultiplier, POLLING_CONFIG.maxInterval);
  }

  if (status !== 'succeeded') {
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
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const fileExtension = contentType.split('/')[1] || 'png'; // Default to png if not found

    const fileName = filename ? `${filename}.${fileExtension}` : `replicate_image_${Date.now()}.${fileExtension}`;

    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit',
      mimetype: contentType,
      buffer: imageBuffer,
      size: imageBuffer.length,
    };

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
