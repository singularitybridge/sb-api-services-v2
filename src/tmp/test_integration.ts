import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { performCurlRequest } from '../integrations/curl/curl.service';
import { ActionContext } from '../integrations/actions/types';
import { SupportedLanguage } from '../services/discovery.service';

const TEST_REQUESTS_DIR = './src/tmp/test-requests';

const testIntegration = async (specificFile?: string) => {
  try {
    // Get files to test - either specific file or all .curl files
    const files = specificFile 
      ? [specificFile]
      : readdirSync(TEST_REQUESTS_DIR).filter(file => file.endsWith('.curl'));
    
    // Create context with required properties
    const context: ActionContext = {
      sessionId: 'test-session',
      companyId: 'test-company',
      language: 'en' as SupportedLanguage
    };

    console.log(`Found ${files.length} test request${files.length === 1 ? '' : 's'} to process\n`);

    // Process each request file
    for (const file of files) {
      const filePath = join(TEST_REQUESTS_DIR, file);
      const curlCommand = readFileSync(filePath, 'utf-8');
      
      console.log(`Testing request: ${file}`);
      console.log('----------------------------------------');
      
      try {
        const response = await performCurlRequest(context, curlCommand);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
      
      console.log('----------------------------------------\n');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Check if a specific file was passed as an argument
const specificFile = process.argv[2];
testIntegration(specificFile);
