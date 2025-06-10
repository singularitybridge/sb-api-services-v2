import fetch from 'node-fetch';
import { getApiKey } from '../../services/api.key.service';

// Hard-coded for now as per user request
// const SCYTALE_API_KEY = 'YOUR_HARDCODED_SCYTALE_API_KEY'; // This was not the correct auth
const SCYTALE_SESSION_COOKIE = 'SCYTALE_COOKIE_REDACTED';
const BASE_URL = 'https://api.scytale.ai/control/608e8c9800518e0012068f48/questionnaires/context/questionnaires';

interface ScytaleQuestionnaireListItem {
  questionnaireId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  resultsFileContent?: string; // This will be removed
}

interface ScytaleQuestionnaireListResponse {
  metadata: {
    companyId: string;
    retrievedAt: string;
  };
  previousQuestionnaires: {
    count: number;
    files: ScytaleQuestionnaireListItem[];
  };
}

interface ScytaleSingleQuestionnaireResponse {
    metadata: {
        companyId: string;
        retrievedAt: string;
    };
    questionnaire: ScytaleQuestionnaireListItem;
}


const getHeaders = async (companyId: string) => {
  // We will use the hardcoded session cookie as per the cURL command
  if (!SCYTALE_SESSION_COOKIE) {
    throw new Error('Scytale session cookie is not configured.');
  }

  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'origin': 'https://app.scytale.ai',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://app.scytale.ai/',
    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Cookie': `scytaleSession=${SCYTALE_SESSION_COOKIE}`, // Using the specific session cookie
    'Content-Type': 'application/json', // Keep this if POST requests are made, otherwise optional for GET
  };
};

export const getQuestionnaires = async (
  sessionId: string,
  companyId: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const headers = await getHeaders(companyId);
    const response = await fetch(BASE_URL, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch questionnaires: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleQuestionnaireListResponse;

    // Remove resultsFileContent from each questionnaire
    if (data.previousQuestionnaires && data.previousQuestionnaires.files) {
      data.previousQuestionnaires.files = data.previousQuestionnaires.files.map(q => {
        const { resultsFileContent, ...rest } = q;
        return rest;
      });
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getQuestionnaires:', error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching questionnaires.' };
  }
};

export const getQuestionnaireById = async (
  sessionId: string,
  companyId: string,
  questionnaireId: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  if (!questionnaireId) {
    throw new Error('The questionnaireId parameter is missing.');
  }
  try {
    const headers = await getHeaders(companyId);
    const url = `${BASE_URL}/${questionnaireId}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch questionnaire ${questionnaireId}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ScytaleSingleQuestionnaireResponse;
    
    // The user did not specify to remove resultsFileContent from single item, 
    // but it's good practice to be consistent if it's not needed.
    // For now, following user spec strictly.

    return { success: true, data };
  } catch (error: any) {
    console.error(`Error in getQuestionnaireById (id: ${questionnaireId}):`, error);
    return { success: false, error: error.message || `An unknown error occurred while fetching questionnaire ${questionnaireId}.` };
  }
};
