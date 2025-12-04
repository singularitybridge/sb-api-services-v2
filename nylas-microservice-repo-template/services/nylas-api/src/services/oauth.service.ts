/**
 * Nylas OAuth Service for Fastify Microservice
 */

import axios from 'axios';
import { config } from '../config.js';

const NYLAS_API_URL = config.nylas.apiUrl;

// ==========================================
// Type Definitions
// ==========================================

export interface AuthorizationUrlParams {
  userId: string;
  companyId: string;
  provider?: 'google' | 'microsoft';
  scopes?: string[];
  customState?: string;
}

export interface GrantInfo {
  id: string;
  grant_id?: string;
  provider: string;
  email: string;
  scope: string[];
  created_at: number;
  updated_at: number;
}

export interface ParsedState {
  userId: string;
  companyId: string;
  timestamp: number;
  custom?: string;
}

// ==========================================
// OAuth URL Generation
// ==========================================

/**
 * Generate Nylas OAuth authorization URL
 */
export async function getAuthorizationUrl(
  params: AuthorizationUrlParams
): Promise<{ url: string; state: string }> {
  const { userId, companyId, provider = 'google', scopes, customState } = params;

  // Default scopes for email and calendar access
  const defaultScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts',
  ];

  const scopeList = scopes || defaultScopes;

  // Generate state with userId for callback verification
  const stateData = {
    userId,
    companyId,
    timestamp: Date.now(),
    custom: customState,
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  // Build authorization URL
  const authUrl = new URL(`${NYLAS_API_URL}/v3/connect/auth`);
  authUrl.searchParams.set('client_id', config.nylas.clientId);
  authUrl.searchParams.set('redirect_uri', config.nylas.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('provider', provider);
  authUrl.searchParams.set('scope', scopeList.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');

  return {
    url: authUrl.toString(),
    state,
  };
}

// ==========================================
// Token Exchange
// ==========================================

/**
 * Exchange authorization code for Nylas grant
 */
export async function exchangeCodeForGrant(code: string): Promise<GrantInfo> {
  try {
    const response = await axios.post(
      `${NYLAS_API_URL}/v3/connect/token`,
      {
        client_id: config.nylas.clientId,
        client_secret: config.nylas.clientSecret,
        redirect_uri: config.nylas.redirectUri,
        code,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const grantData = response.data;

    // Nylas v3 returns grant_id, not id - normalize it
    if (grantData.grant_id && !grantData.id) {
      grantData.id = grantData.grant_id;
    }

    if (!grantData.id) {
      throw new Error('Nylas did not return a grant ID');
    }

    return grantData;
  } catch (error: any) {
    throw new Error(
      `Failed to exchange code for grant: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// State Parsing
// ==========================================

/**
 * Parse OAuth state parameter
 */
export function parseState(state: string): ParsedState {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);

    // Validate state age (max 1 hour)
    const age = Date.now() - parsed.timestamp;
    if (age > 60 * 60 * 1000) {
      throw new Error('State expired');
    }

    return parsed;
  } catch (error) {
    throw new Error('Invalid state parameter');
  }
}

// ==========================================
// Grant Management (Placeholder - main app handles DB)
// ==========================================

/**
 * Revoke Nylas grant via API
 * Note: Actual database operations handled by main app
 */
export async function revokeGrant(grantId: string): Promise<void> {
  try {
    await axios.delete(`${NYLAS_API_URL}/v3/grants/${grantId}`, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    throw new Error(
      `Failed to revoke grant: ${error.response?.data?.message || error.message}`
    );
  }
}
