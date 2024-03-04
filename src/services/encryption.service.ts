import * as crypto from 'crypto';
import { ICompany } from '../models/Company';

const algorithm = 'aes-256-gcm';
const encryption_key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const ivLength = 16;

const keysToEncrypt = [
  'openai_api_key',
  'gcp_key',
  'notion_api_key',
  'labs11_api_key',
  'twilio_account_sid',
  'twilio_auth_token',
];

export const encryptCompanyData = (companyData: any) => {
  keysToEncrypt.forEach((key) => {
    if (companyData[key]) {
      const iv = crypto.randomBytes(ivLength);
      const cipher = crypto.createCipheriv(algorithm, encryption_key, iv);
      let encrypted = cipher.update(companyData[key], 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');

      companyData[key] = {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag,
      };
    }
  });
};

export const decryptCompanyData = (companyData: any) => {
  keysToEncrypt.forEach((key) => {
    if (companyData[key]) {
      const decipher = crypto.createDecipheriv(
        algorithm,
        encryption_key,
        Buffer.from(companyData[key].iv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(companyData[key].tag, 'hex'));
      let decrypted = decipher.update(
        companyData[key].encrypted,
        'hex',
        'utf8',
      );
      decrypted += decipher.final('utf8');
      companyData[key] = decrypted;
    }
  });
};
