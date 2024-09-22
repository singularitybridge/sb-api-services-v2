import axios from 'axios';
import { getCompany } from '../../services/company.service';

const API_URL = 'https://sdk.photoroom.com/v1/segment';

export const removeBackgroundFromImage = async (companyId: string, imageUrl: string, crop: boolean = false): Promise<Buffer> => {
  const company = await getCompany(companyId);
  const apiKey = company.api_keys.find((key: { key: string; value: string }) => key.key === 'photoroom_api_key')?.value;

  if (!apiKey) {
    throw new Error('PhotoRoom API key not found for the company');
  }

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

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error removing background:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data.toString());
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw new Error('Failed to remove background from image');
  }
};