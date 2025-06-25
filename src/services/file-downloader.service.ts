import axios from 'axios';

export const downloadFile = async (url: string): Promise<Buffer> => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return response.data;
};
