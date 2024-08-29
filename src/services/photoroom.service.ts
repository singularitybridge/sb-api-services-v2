import https from 'https';
import fs from 'fs';

class PhotoRoomService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = '59113086e3977b60c8c5a0fbb0dae1c50c6a36b4';
    this.apiUrl = 'https://image-api.photoroom.com/v2/edit';
  }

  async removeBackground(imageUrl: string): Promise<Buffer> {
    const editParams = 'background.color=transparent&background.expandPrompt=never&background.scaling=fill&outputSize=1000x1000&padding=0.1';
    const options = {
      hostname: 'image-api.photoroom.com',
      port: 443,
      path: `/v2/edit?${editParams}&imageUrl=${encodeURIComponent(imageUrl)}`,
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey
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