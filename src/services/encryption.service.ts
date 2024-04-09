import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const ivLength = 16;

export const encryptData = (data: string) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
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
    encryptionKey,
    Buffer.from(encryptedData.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  let decrypted = decipher.update(encryptedData.value, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
