import { readFileSync } from 'fs';
import axios from 'axios';

const readAndParseRequest = (filePath: string): {
  url: string;
  headers: Record<string, string>;
  data: any;
} => {
  const content = readFileSync(filePath, 'utf-8');
  
  // Extract URL
  const urlMatch = content.match(/curl --location '([^']+)'/);
  const url = urlMatch?.[1];
  if (!url) throw new Error('Could not parse URL');

  // Extract headers
  const headers: Record<string, string> = {};
  const headerMatches = content.matchAll(/--header '([^:]+): ([^']+)'/g);
  for (const match of Array.from(headerMatches)) {
    headers[match[1]] = match[2];
  }

  // Extract data
  const dataMatch = content.match(/--data-raw '({[\s\S]*?})'/);
  const data = dataMatch?.[1] ? JSON.parse(dataMatch[1]) : null;

  return { url, headers, data };
};

const executeRequest = async () => {
  try {
    const { url, headers, data } = readAndParseRequest('./src/tmp/request.txt');

    console.log('Executing request with:');
    console.log('URL:', url);
    console.log('Headers:', headers);
    console.log('Data:', JSON.stringify(data, null, 2));

    const response = await axios({
      method: 'post',
      url,
      headers,
      data,
      validateStatus: () => true // Accept any status code
    });

    console.log('\nResponse:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Request failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    } else {
      console.error('Error:', error);
    }
  }
};

executeRequest();
