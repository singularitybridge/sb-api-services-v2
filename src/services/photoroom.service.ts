import https from 'https';
import { getCompany } from './company.service';

class PhotoRoomService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = 'https://image-api.photoroom.com/v2/edit';
  }

  async removeBackground(companyId: string, imageUrl: string): Promise<Buffer> {
    const company = await getCompany(companyId);
    const apiKey = company.api_keys.find((key: { key: string; value: string }) => key.key === 'photoroom_api_key')?.value;

    if (!apiKey) {
      throw new Error('PhotoRoom API key not found for the company');
    }

    const editParams = 'background.color=transparent&background.expandPrompt=never&background.scaling=fill&outputSize=1000x1000&padding=0.1';
    const options = {
      hostname: 'image-api.photoroom.com',
      port: 443,
      path: `/v2/edit?${editParams}&imageUrl=${encodeURIComponent(imageUrl)}`,
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        if (res.statusCode === 200) {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}`));
        }
      });

      req.on('error', error => {
        reject(error);
      });

      req.end();
    });
  }
}

export const photoRoomService = new PhotoRoomService();