import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { uploadFile } from '../../services/google.storage.service';
import { Readable } from 'stream';

interface FluxImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
}

export const generateFluxImage = async (companyId: string, options: FluxImageGenerationOptions): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'getimg_api_key');
  if (!apiKey) {
    throw new Error('GetImg API key not found');
  }

  const { prompt, width = 1024, height = 1024 } = options;

  try {
    const response = await axios.post(
      'https://api.getimg.ai/v1/flux-schnell/text-to-image',
      {
        prompt,
        width,
        height,
        response_format: 'b64'
      },
      {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json'
        }
      }
    );

    const imageBuffer = Buffer.from(response.data.image, 'base64');
    const fileName = `flux_image_${Date.now()}.png`;

    // Create a partial File object that includes only the necessary properties
    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: imageBuffer,
      size: imageBuffer.length,
    };

    const publicUrl = await uploadFile(file as Express.Multer.File);

    return publicUrl;
  } catch (error) {
    console.error('Error generating Flux image:', error);
    throw new Error('Failed to generate Flux image');
  }
};