import axios from 'axios';
import { getApiKey } from './api.key.service';
import { ApiKey } from './verification.service';

const BASE_URL = 'https://api.jsonbin.io/v3';

const getHeaders = async (companyId: string, binName?: string) => {
  const apiKey = await getApiKey(companyId, 'jsonbin_api_key');
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

const mergeDeep = (target: any, source: any) => {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach(key => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
};

export const updateArrayElement = async (companyId: string, binId: string, arrayKey: string, elementId: string, updateData: any, useMerge: boolean = false): Promise<any> => {
  try {
    const headers = await getHeaders(companyId);
    const currentData = await readFile(companyId, binId);

    if (!currentData[arrayKey] || !Array.isArray(currentData[arrayKey])) {
      throw new Error(`Array '${arrayKey}' not found in the JSON file`);
    }

    const elementIndex = currentData[arrayKey].findIndex((item: any) => item.id === elementId);

    if (elementIndex === -1) {
      throw new Error(`Element with id '${elementId}' not found in the array '${arrayKey}'`);
    }

    if (useMerge) {
      currentData[arrayKey][elementIndex] = mergeDeep(currentData[arrayKey][elementIndex], updateData);
    } else {
      currentData[arrayKey][elementIndex] = { ...currentData[arrayKey][elementIndex], ...updateData };
    }

    const response = await axios.put(`${BASE_URL}/b/${binId}`, currentData, { headers });
    return response.data.record;
  } catch (error) {
    console.error('Error updating array element in JSONBin:', error);
    throw error;
  }
};

export const deleteArrayElement = async (companyId: string, binId: string, arrayKey: string, elementId: string): Promise<any> => {
  try {
    const headers = await getHeaders(companyId);
    const currentData = await readFile(companyId, binId);

    if (!currentData[arrayKey] || !Array.isArray(currentData[arrayKey])) {
      throw new Error(`Array '${arrayKey}' not found in the JSON file`);
    }

    currentData[arrayKey] = currentData[arrayKey].filter((item: any) => item.id !== elementId);

    const response = await axios.put(`${BASE_URL}/b/${binId}`, currentData, { headers });
    return response.data.record;
  } catch (error) {
    console.error('Error deleting array element in JSONBin:', error);
    throw error;
  }
};

export const insertArrayElement = async (companyId: string, binId: string, arrayKey: string, newElement: any): Promise<any> => {
  try {
    const headers = await getHeaders(companyId);
    const currentData = await readFile(companyId, binId);

    if (!currentData[arrayKey]) {
      currentData[arrayKey] = [];
    }

    if (!Array.isArray(currentData[arrayKey])) {
      throw new Error(`'${arrayKey}' is not an array in the JSON file`);
    }

    const newId = Math.random().toString(36).substr(2, 9);
    const elementWithId = { ...newElement, id: newId };

    currentData[arrayKey].push(elementWithId);

    const response = await axios.put(`${BASE_URL}/b/${binId}`, currentData, { headers });
    return response.data.record;
  } catch (error) {
    console.error('Error inserting array element in JSONBin:', error);
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

export const cloneJsonbin = async (companyId: string, binId: string): Promise<string> => {
  try {
    const data = await readFile(companyId, binId);
    const clonedBin = await createFile(companyId, data);
    return clonedBin.metadata.id;
  } catch (error) {
    console.error('Error cloning JSONBin:', error);
    throw error;
  }
};