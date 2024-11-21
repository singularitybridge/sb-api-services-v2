import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { uploadFile } from '../../services/google.storage.service';

const API_URL = 'https://sdk.photoroom.com/v1/segment';

interface RemoveBackgroundOptions {
  imageUrl: string;
  filename?: string;
  crop?: boolean;
}

export const removeBackgroundFromImage = async (companyId: string, options: RemoveBackgroundOptions): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'photoroom_api_key');
  if (!apiKey) {
    throw new Error('PhotoRoom API key not found');
  }

  const { imageUrl, filename, crop = false } = options;

  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const formData = new FormData();
    formData.append('image_file', new Blob([imageResponse.data], { type: imageResponse.headers['content-type'] }), 'image.jpg');
    formData.append('format', 'png');
    formData.append('crop', crop.toString());

    const response = await axios.post(API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-api-key': apiKey,
        'Accept': 'image/png, application/json'
      },
      responseType: 'arraybuffer'
    });

    const processedImage = Buffer.from(response.data);
    const fileName = filename ? `${filename}.png` : `photoroom_image_${Date.now()}.png`;

    // Create a partial File object that includes only the necessary properties
    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: processedImage,
      size: processedImage.length,
    };

    const publicUrl = await uploadFile(file as Express.Multer.File);

    return publicUrl;
  } catch (error) {
    console.error('Error processing image with PhotoRoom:', error);
    throw new Error('Failed to process image with PhotoRoom');
  }
};
