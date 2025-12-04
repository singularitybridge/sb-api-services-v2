/**
 * Webhooks Service Configuration
 */

export interface Config {
  port: number;
  host: string;
  webhookSecret: string;
  mainAppUrl: string;
  database: {
    uri: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.WEBHOOKS_SERVICE_PORT || '3002', 10),
  host: process.env.WEBHOOKS_SERVICE_HOST || '127.0.0.1',
  webhookSecret: process.env.NYLAS_WEBHOOK_SECRET || '',
  mainAppUrl: process.env.MAIN_APP_URL || 'http://localhost:3000',
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/singularity-bridge',
  },
};

// Validate required configuration
export function validateConfig(): void {
  const warnings: string[] = [];

  if (!config.webhookSecret) {
    warnings.push('NYLAS_WEBHOOK_SECRET not set - webhook signature verification disabled');
  }

  if (warnings.length > 0) {
    console.warn('[CONFIG] Warnings:', warnings.join(', '));
  }
}
