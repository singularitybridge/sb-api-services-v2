/// file_path: src/services/encryption.service.ts
import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 16;

// Lazy load the encryption key to ensure env vars are loaded
let encryptionKey: Buffer | null = null;

const getEncryptionKey = (): Buffer => {
  if (!encryptionKey) {
    const keyHex = process.env.ENCRYPTION_KEY || '';
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }
    encryptionKey = Buffer.from(keyHex, 'hex');
  }
  return encryptionKey;
};

export const encryptData = (data: string) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    value: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
};

export const decryptData = (encryptedData: {
  value: string;
  iv: string;
  tag: string;
}) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(encryptedData.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  let decrypted = decipher.update(encryptedData.value, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
