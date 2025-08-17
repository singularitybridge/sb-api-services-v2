import axios, { AxiosError } from 'axios';

export const downloadFile = async (url: string): Promise<Buffer> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      // Important: Don't let axios encode the URL further
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept any status < 500
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
    if (error instanceof AxiosError && error.response?.data) {
      // Log the actual error response from S3
      const errorText = Buffer.from(error.response.data).toString('utf-8');
      console.error(`S3 Error Response:`, errorText);
    }
    console.error(`Error downloading file from URL: ${url}`, error);
    throw error; // Re-throw the error so it can be caught by the calling service
  }
};
