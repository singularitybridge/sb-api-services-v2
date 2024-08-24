import axios from 'axios';
import { getApiKey } from './api.key.service';
import { ApiKey } from './verification.service';

const BASE_URL = 'https://api.jsonbin.io/v3';

const getHeaders = async (companyId: string, binName?: string) => {
  const apiKey = await getApiKey(companyId, 'jsonbin');
  if (!apiKey) {
    throw new Error('Failed to retrieve JSONBin API key');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Master-Key': apiKey,
    'X-Bin-Private': 'false',
  };
  
  if (binName) {
    headers['X-Bin-Name'] = binName;
  }
  
  return headers;
};

export const createFile = async (companyId: string, data: any, binName?: string): Promise<any> => {
  try {
    const headers = await getHeaders(companyId, binName);
    const response = await axios.post(`${BASE_URL}/b`, data, { headers });
    return response.data;
  } catch (error) {
    console.error('Error creating file in JSONBin:', error);
    throw error;
  }
};

export const readFile = async (companyId: string, binId: string): Promise<any> => {
  try {
    const headers = await getHeaders(companyId);
    const response = await axios.get(`${BASE_URL}/b/${binId}`, { headers });
    return response.data.record; // Return only the content of the "record" field
  } catch (error) {
    console.error('Error reading file from JSONBin:', error);
    throw error;
  }
};

export const updateFile = async (companyId: string, binId: string, data: any): Promise<any> => {
  try {
    const headers = await getHeaders(companyId);
    const response = await axios.put(`${BASE_URL}/b/${binId}`, data, { headers });
    return response.data.record;
  } catch (error) {
    console.error('Error updating file in JSONBin:', error);
    throw error;
  }
};

export const verifyJsonBinKey = async (key: ApiKey): Promise<boolean> => {
  if (typeof key !== 'string') {
    console.error('Invalid JSONBin key type');
    return false;
  }
  try {
    const response = await axios.get(`${BASE_URL}/c`, {
      headers: {
        'X-Master-key': key,
      },
    });
    return response.status === 200;
  } catch (error) {
    console.error('Error verifying JSONBin key:', error);
    return false;
  }
};