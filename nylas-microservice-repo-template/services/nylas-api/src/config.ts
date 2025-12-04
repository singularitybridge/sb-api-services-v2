/**
 * Nylas Service Configuration
 */

export interface Config {
  port: number;
  host: string;
  nylas: {
    clientId: string;
    clientSecret: string;
    apiUrl: string;
    redirectUri: string;
  };
  database: {
    uri: string;
  };
  frontend: {
    successRedirect: string;
    errorRedirect: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.NYLAS_SERVICE_PORT || '3001', 10),
  host: process.env.NYLAS_SERVICE_HOST || '127.0.0.1',

  nylas: {
    clientId: process.env.NYLAS_CLIENT_ID || '',
    clientSecret: process.env.NYLAS_API_SECRET || process.env.NYLAS_CLIENT_SECRET || '',
    apiUrl: process.env.NYLAS_API_URL || 'https://api.us.nylas.com',
    redirectUri: process.env.NYLAS_REDIRECT_URI || 'http://localhost:3001/oauth/callback',
  },

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/singularity-bridge',
  },

  frontend: {
    successRedirect: process.env.NYLAS_SUCCESS_REDIRECT || 'http://localhost:5173/settings/integrations?connected=true',
    errorRedirect: process.env.NYLAS_ERROR_REDIRECT || 'http://localhost:5173/settings/integrations?error=auth_failed',
  },
};

// Validate required configuration
export function validateConfig(): void {
  const required = [
    { key: 'NYLAS_CLIENT_ID', value: config.nylas.clientId },
    { key: 'NYLAS_CLIENT_SECRET or NYLAS_API_SECRET', value: config.nylas.clientSecret },
    { key: 'MONGODB_URI', value: config.database.uri },
  ];

  const missing = required.filter(r => !r.value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(m => m.key).join(', ')}`
    );
  }
}
