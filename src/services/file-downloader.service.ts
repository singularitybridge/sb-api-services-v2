import axios from 'axios';

export const downloadFile = async (url: string): Promise<Buffer> => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
  } catch (error) {
    console.error(`Error downloading file from URL: ${url}`, error);
    throw error; // Re-throw the error so it can be caught by the calling service
  }
};
