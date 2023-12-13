import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';

export const generatedFilesBaseURL = 'https://sb-api.ngrok.app/tts/files';

export interface SaveToFileResponse {
  key: string;
  path: string;
}

export async function saveToFile(
  data: Buffer | stream.Readable,
): Promise<SaveToFileResponse> {
  const uniqueFileName = `file_${uuidv4()}.mp3`;
  const dir = './files';
  const filePath = `${dir}/${uniqueFileName}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const writable = fs.createWriteStream(filePath);

  if (data instanceof Buffer) {
    fs.writeFileSync(filePath, data);
  } else {
    data.pipe(writable);
    await new Promise((resolve, reject) => {
      writable.on('finish', resolve);
      writable.on('error', reject);
    });
  }

  return {
    key: uniqueFileName,
    path: `${generatedFilesBaseURL}/${uniqueFileName}`,
  };
}
