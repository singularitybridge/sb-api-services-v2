import fs from 'fs';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import stream from 'stream';

export const generatedFilesBaseURL = 'https://sb-api.ngrok.app/tts/files';

export interface SaveToFileResponse {
  key: string;
  path: string;
}

export async function saveToFile(data: Buffer | stream.Readable): Promise<SaveToFileResponse> {
  const uniqueFileName = `file_${uuidv4()}.mp3`;
  const dir = './files';
  const filePath = `${dir}/${uniqueFileName}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (data instanceof Buffer) {
    const writeFileAsync = promisify(fs.writeFile);
    await writeFileAsync(filePath, data, 'binary');
  } else if (data instanceof stream.Readable) {
    const writable = fs.createWriteStream(filePath);
    data.pipe(writable);
    await new Promise((resolve, reject) => {
      writable.on('finish', resolve);
      writable.on('error', reject);
    });
  } else {
    throw new TypeError('Invalid data type for saveToFile');
  }

  return {
    key: uniqueFileName,
    path: `${generatedFilesBaseURL}/${uniqueFileName}`,
  };
}
