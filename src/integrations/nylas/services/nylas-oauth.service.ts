/**
 * Nylas OAuth Service
 *
 * Handles per-user OAuth flow for Nylas email/calendar integration
 * Each user connects their own Google/Microsoft account
 *
 * Flow:
 * 1. User clicks "Connect Email" -> getAuthorizationUrl()
 * 2. User authorizes on Nylas -> Nylas redirects to callback
 * 3. Callback receives code -> exchangeCodeForGrant()
 * 4. Store grant in NylasAccount with userId mapping
 */

import axios from 'axios';
import { getApiKey } from '../../../services/api.key.service';
import { NylasAccount, INylasAccount } from '../models/NylasAccount';
import { User } from '../../../models/User';
import { EmailProfile } from '../models/EmailProfile';
import { NylasEventCache } from '../models/NylasEventCache';
import mongoose, { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';

const NYLAS_API_URL = 'https://api.us.nylas.com';
const BACKUP_DIR = path.join(process.cwd(), 'oauth-deletion-backups');

// ==========================================
// OAuth Configuration
// ==========================================

export interface NylasOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Get OAuth configuration for a company
 */
export async function getOAuthConfig(companyId: string): Promise<NylasOAuthConfig> {
  // Try company-specific credentials first
  let clientId = await getApiKey(companyId, 'nylas_client_id');
  let clientSecret = await getApiKey(companyId, 'nylas_client_secret');

  // Fall back to environment variables (service account credentials)
  if (!clientId) {
    clientId = process.env.NYLAS_CLIENT_ID;
    console.log('[NYLAS OAUTH] Using service account NYLAS_CLIENT_ID from environment');
  }

  if (!clientSecret) {
    clientSecret = process.env.NYLAS_API_SECRET || process.env.NYLAS_CLIENT_SECRET;
    console.log('[NYLAS OAUTH] Using service account NYLAS_API_SECRET from environment');
  }

  const redirectUri = process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/nylas/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Nylas OAuth credentials not configured (neither company-specific nor environment variables found)');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

// ==========================================
// OAuth URL Generation
// ==========================================

export interface AuthorizationUrlParams {
  companyId: string;
  userId: string;
  provider?: 'google' | 'microsoft';
  scopes?: string[];
  state?: string; // Optional custom state data
}

/**
 * Generate Nylas OAuth authorization URL
 * User will be redirected to this URL to authorize access
 */
export async function getAuthorizationUrl(params: AuthorizationUrlParams): Promise<{
  url: string;
  state: string;
}> {
  const { companyId, userId, provider = 'google', scopes, state: customState } = params;
  const config = await getOAuthConfig(companyId);

  // Default scopes for email and calendar access
  const defaultScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts',
  ];

  const scopeList = scopes || defaultScopes;

  // Generate state with userId for callback verification
  // Format: userId:companyId:customState (URL-safe)
  const stateData = {
    userId,
    companyId,
    timestamp: Date.now(),
    custom: customState,
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  // Build authorization URL
  const authUrl = new URL(`${NYLAS_API_URL}/v3/connect/auth`);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('provider', provider);
  authUrl.searchParams.set('scope', scopeList.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
  // Note: Nylas v3 doesn't support 'prompt' parameter - removed

  console.log('[NYLAS OAUTH] Generated authorization URL:', {
    userId,
    companyId,
    provider,
    scopes: scopeList.length,
  });

  return {
    url: authUrl.toString(),
    state,
  };
}

// ==========================================
// Token Exchange
// ==========================================

export interface GrantInfo {
  id: string; // Nylas grant ID
  provider: string;
  email: string;
  scope: string[];
  created_at: number;
  updated_at: number;
}

/**
 * Exchange authorization code for Nylas grant
 * Called in OAuth callback after user authorizes
 */
export async function exchangeCodeForGrant(
  code: string,
  companyId: string,
  userId: string
): Promise<GrantInfo> {
  const config = await getOAuthConfig(companyId);

  console.log('[NYLAS OAUTH] Exchanging code for grant:', {
    userId,
    companyId,
  });

  try {
    const response = await axios.post(
      `${NYLAS_API_URL}/v3/connect/token`,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
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

    console.log('[NYLAS OAUTH] Raw Nylas response:', JSON.stringify(grantData, null, 2));

    // Nylas v3 returns grant_id, not id - normalize it
    if (grantData.grant_id && !grantData.id) {
      grantData.id = grantData.grant_id;
      console.log('[NYLAS OAUTH] Normalized grant_id to id:', grantData.id);
    }

    if (!grantData.id) {
      console.error('[NYLAS OAUTH] ERROR: No grant ID found in response!');
      console.error('[NYLAS OAUTH] Response keys:', Object.keys(grantData));
      throw new Error('Nylas did not return a grant ID');
    }

    console.log('[NYLAS OAUTH] Grant created successfully:', {
      grantId: grantData.id,
      email: grantData.email,
      provider: grantData.provider,
    });

    return grantData;
  } catch (error: any) {
    console.error('[NYLAS OAUTH] Token exchange failed:', error.response?.data || error.message);
    throw new Error(`Failed to exchange code for grant: ${error.response?.data?.message || error.message}`);
  }
}

// ==========================================
// Grant Storage
// ==========================================

/**
 * Store or update Nylas grant in database
 * Links userId to grantId for per-user access
 */
export async function storeGrant(
  userId: string,
  companyId: string,
  grantInfo: GrantInfo
): Promise<INylasAccount> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  // DETAILED LOGGING: See exactly what grantInfo contains
  console.log('[NYLAS OAUTH] storeGrant called with:', {
    userId,
    companyId,
    'grantInfo.id': grantInfo.id,
    'grantInfo.email': grantInfo.email,
    'grantInfo.provider': grantInfo.provider,
    'typeof grantInfo.id': typeof grantInfo.id,
    'grantInfo keys': Object.keys(grantInfo),
    'full grantInfo': JSON.stringify(grantInfo, null, 2),
  });

  if (!grantInfo.id) {
    console.error('[NYLAS OAUTH] ERROR: grantInfo.id is undefined or falsy!');
    console.error('[NYLAS OAUTH] Full grantInfo object:', grantInfo);
    throw new Error('Grant ID is missing from grantInfo');
  }

  console.log('[NYLAS OAUTH] Storing grant:', {
    userId,
    companyId,
    grantId: grantInfo.id,
    email: grantInfo.email,
  });

  // Check if user already has a connected account
  const existingAccount = await NylasAccount.findOne({
    userId: userObjectId,
    companyId: companyObjectId,
    isActive: true,
  });

  if (existingAccount) {
    // Update existing account
    existingAccount.nylasGrantId = grantInfo.id;
    existingAccount.provider = grantInfo.provider as any;
    existingAccount.emailAddress = grantInfo.email;
    existingAccount.scopes = grantInfo.scope;
    existingAccount.status = 'active';
    existingAccount.lastValidatedAt = new Date();
    await existingAccount.save();

    console.log('[NYLAS OAUTH] Updated existing account:', existingAccount._id);
    return existingAccount;
  }

  // Create new account
  const newAccount = new NylasAccount({
    userId: userObjectId,
    companyId: companyObjectId,
    nylasGrantId: grantInfo.id,
    provider: grantInfo.provider,
    emailAddress: grantInfo.email,
    scopes: grantInfo.scope,
    status: 'active',
    isActive: true,
    lastValidatedAt: new Date(),
  });

  await newAccount.save();

  console.log('[NYLAS OAUTH] Created new account:', newAccount._id);
  return newAccount;
}

// ==========================================
// Grant Management
// ==========================================

/**
 * Get user's Nylas account
 */
export async function getUserAccount(
  userId: string,
  companyId: string
): Promise<INylasAccount | null> {
  return await NylasAccount.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isActive: true,
  });
}

/**
 * Disconnect user's Nylas account
 * Revokes grant and marks account as inactive
 */
export async function disconnectAccount(
  userId: string,
  companyId: string
): Promise<void> {
  const account = await getUserAccount(userId, companyId);

  if (!account) {
    throw new Error('No connected account found');
  }

  console.log('[NYLAS OAUTH] Disconnecting account:', {
    userId,
    grantId: account.nylasGrantId,
  });

  // Call disconnect method (will revoke grant via Nylas API if implemented)
  await account.disconnect();

  console.log('[NYLAS OAUTH] Account disconnected successfully');
}

/**
 * Check if user has connected account
 */
export async function isAccountConnected(
  userId: string,
  companyId: string
): Promise<boolean> {
  const account = await getUserAccount(userId, companyId);
  return account !== null && account.status === 'active';
}

/**
 * Get account status with details
 */
export async function getAccountStatus(
  userId: string,
  companyId: string
): Promise<{
  connected: boolean;
  email?: string;
  provider?: string;
  lastValidated?: Date;
}> {
  const account = await getUserAccount(userId, companyId);

  if (!account) {
    return { connected: false };
  }

  return {
    connected: account.status === 'active',
    email: account.emailAddress,
    provider: account.provider,
    lastValidated: account.lastValidatedAt,
  };
}

// ==========================================
// State Parsing
// ==========================================

export interface ParsedState {
  userId: string;
  companyId: string;
  timestamp: number;
  custom?: string;
}

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
// Safe Deletion & Backup
// ==========================================

export interface DeletionBackup {
  timestamp: string;
  userId: string;
  companyId: string;
  user: any;
  nylasAccount: any;
  emailProfiles: any[];
  eventCacheCount: number;
  metadata: {
    purpose: string;
    backupFile: string;
  };
}

export interface DeletionVerification {
  userPreserved: boolean;
  accountRevoked: boolean;
  profilesDeactivated: boolean;
  noActiveGrants: boolean;
  errors: string[];
}

/**
 * Create backup snapshot before deletion
 * Returns backup file path for rollback
 */
export async function createDeletionBackup(
  userId: string,
  companyId: string
): Promise<{ backupFile: string; backup: DeletionBackup }> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  console.log('[NYLAS OAUTH] Creating deletion backup:', { userId, companyId });

  // Get user
  const user = await User.findById(userObjectId).lean();
  if (!user) {
    throw new Error('User not found');
  }

  // Get NylasAccount
  const nylasAccount = await NylasAccount.findOne({
    userId: userObjectId,
    companyId: companyObjectId,
  }).lean();

  // Get related EmailProfiles
  const emailProfiles = nylasAccount
    ? await EmailProfile.find({
        nylasAccountId: nylasAccount._id,
      }).lean()
    : [];

  // Get cached events count
  const eventCacheCount = nylasAccount
    ? await NylasEventCache.countDocuments({
        nylasAccountId: nylasAccount._id,
      })
    : 0;

  // Create backup object
  const timestamp = new Date().toISOString();
  const backupFileName = `${userId}_${Date.now()}.json`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  const backup: DeletionBackup = {
    timestamp,
    userId,
    companyId,
    user,
    nylasAccount,
    emailProfiles,
    eventCacheCount,
    metadata: {
      purpose: 'OAuth deletion backup',
      backupFile: backupFileName,
    },
  };

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Save backup to file
  fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2));

  console.log('[NYLAS OAUTH] Backup created:', {
    file: backupFileName,
    hasAccount: !!nylasAccount,
    profilesCount: emailProfiles.length,
    eventsCount: eventCacheCount,
  });

  return { backupFile: backupFileName, backup };
}

/**
 * Safe disconnect with automatic backup
 * Creates backup before disconnecting
 */
export async function safeDisconnectWithBackup(
  userId: string,
  companyId: string
): Promise<{ backupFile: string; disconnected: boolean }> {
  console.log('[NYLAS OAUTH] Safe disconnect with backup:', { userId, companyId });

  // Create backup first
  const { backupFile } = await createDeletionBackup(userId, companyId);

  // Perform disconnect
  try {
    await disconnectAccount(userId, companyId);
    return { backupFile, disconnected: true };
  } catch (error: any) {
    // If no account found, that's okay - already disconnected
    if (error.message === 'No connected account found') {
      console.log('[NYLAS OAUTH] No account to disconnect (already disconnected)');
      return { backupFile, disconnected: false };
    }
    throw error;
  }
}

/**
 * Clean up related data after disconnection
 * Deactivates EmailProfiles and deletes cache
 */
export async function cleanupRelatedData(
  userId: string,
  companyId: string
): Promise<{ profilesDeactivated: number; cacheDeleted: number }> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  console.log('[NYLAS OAUTH] Cleaning up related data:', { userId, companyId });

  // Get revoked account
  const revokedAccount = await NylasAccount.findOne({
    userId: userObjectId,
    companyId: companyObjectId,
    status: 'revoked',
  });

  if (!revokedAccount) {
    console.log('[NYLAS OAUTH] No revoked account found to clean up');
    return { profilesDeactivated: 0, cacheDeleted: 0 };
  }

  // Deactivate EmailProfiles
  const profileResult = await EmailProfile.updateMany(
    { nylasAccountId: revokedAccount._id },
    { $set: { isActive: false } }
  );

  // Delete cached events (it's just cache, safe to remove)
  const cacheResult = await NylasEventCache.deleteMany({
    nylasAccountId: revokedAccount._id,
  });

  console.log('[NYLAS OAUTH] Cleanup completed:', {
    profilesDeactivated: profileResult.modifiedCount,
    cacheDeleted: cacheResult.deletedCount,
  });

  return {
    profilesDeactivated: profileResult.modifiedCount,
    cacheDeleted: cacheResult.deletedCount,
  };
}

/**
 * Verify deletion was safe
 * Checks that user is preserved, account revoked, and no active grants
 */
export async function verifyDeletionSafety(
  userId: string,
  companyId: string
): Promise<DeletionVerification> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  console.log('[NYLAS OAUTH] Verifying deletion safety:', { userId, companyId });

  const results: DeletionVerification = {
    userPreserved: true,
    accountRevoked: true,
    profilesDeactivated: true,
    noActiveGrants: true,
    errors: [],
  };

  // Check user still exists
  const user = await User.findById(userObjectId).lean();
  if (!user) {
    results.userPreserved = false;
    results.errors.push('CRITICAL: User record was deleted!');
  }

  // Check NylasAccount is revoked
  const account = await NylasAccount.findOne({
    userId: userObjectId,
    companyId: companyObjectId,
  }).lean();

  if (account && account.status !== 'revoked') {
    results.accountRevoked = false;
    results.errors.push(`Account not revoked: status=${account.status}`);
  }

  // Check no active grants
  const activeGrants = await NylasAccount.countDocuments({
    userId: userObjectId,
    companyId: companyObjectId,
    isActive: true,
    status: 'active',
  });

  if (activeGrants > 0) {
    results.noActiveGrants = false;
    results.errors.push(`Found ${activeGrants} active grants (should be 0)`);
  }

  // Check profiles deactivated
  const activeProfiles = account
    ? await EmailProfile.countDocuments({
        nylasAccountId: account._id,
        isActive: true,
      })
    : 0;

  if (activeProfiles > 0) {
    results.profilesDeactivated = false;
    results.errors.push(`Found ${activeProfiles} active EmailProfiles (should be 0)`);
  }

  console.log('[NYLAS OAUTH] Verification results:', results);

  return results;
}

/**
 * Rollback deletion from backup
 * Restores NylasAccount and EmailProfiles to active state
 */
export async function rollbackDeletion(
  userId: string,
  companyId: string,
  backupFileName: string
): Promise<{ restored: boolean; message: string }> {
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  console.log('[NYLAS OAUTH] Rolling back deletion:', {
    userId,
    companyId,
    backupFile: backupFileName,
  });

  // Check backup file exists
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFileName}`);
  }

  // Load backup
  const backup: DeletionBackup = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

  // Verify backup matches request
  if (backup.userId !== userId || backup.companyId !== companyId) {
    throw new Error('Backup file does not match userId/companyId');
  }

  // Restore NylasAccount
  if (backup.nylasAccount) {
    await NylasAccount.updateOne(
      { _id: backup.nylasAccount._id },
      {
        $set: {
          status: 'active',
          isActive: true,
          userId: new mongoose.Types.ObjectId(backup.nylasAccount.userId),
        },
      }
    );
    console.log('[NYLAS OAUTH] Restored NylasAccount');
  }

  // Reactivate EmailProfiles
  const profileIds = backup.emailProfiles.map(p => p._id);
  if (profileIds.length > 0) {
    await EmailProfile.updateMany(
      { _id: { $in: profileIds } },
      { $set: { isActive: true } }
    );
    console.log('[NYLAS OAUTH] Reactivated EmailProfiles:', profileIds.length);
  }

  return {
    restored: true,
    message: `Restored from backup ${backupFileName}`,
  };
}

/**
 * List available backups for a user
 */
export async function listBackups(
  userId: string
): Promise<Array<{ fileName: string; timestamp: string; size: number }>> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR);
  const userBackups = files.filter(f => f.startsWith(`${userId}_`) && f.endsWith('.json'));

  return userBackups.map(fileName => {
    const filePath = path.join(BACKUP_DIR, fileName);
    const stats = fs.statSync(filePath);
    const backup: DeletionBackup = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    return {
      fileName,
      timestamp: backup.timestamp,
      size: stats.size,
    };
  });
}
