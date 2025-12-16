/**
 * Nylas Grant Resolution Utility
 *
 * Resolves grant ID for Nylas operations with fallback chain:
 * 1. User-specific grant (via userEmail lookup in V3)
 * 2. Company default grant (from API keys)
 * 3. V3 microservice default grant (NYLAS_GRANT_ID secret)
 */

import axios from 'axios';
import { getApiKey } from '../../../services/api.key.service';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

/**
 * Resolve grant ID for a specific user email by calling V3 microservice
 * Falls back to company default, then to V3's default grant
 *
 * @param companyId - Company ID
 * @param userEmail - Optional user email for per-user grant lookup
 * @returns Grant ID (empty string means use V3 default)
 */
export async function resolveGrantId(companyId: string, userEmail?: string): Promise<string> {
  // If userEmail provided, try to get user-specific grant from V3
  if (userEmail) {
    try {
      const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/grants/by-email`, {
        params: { email: userEmail.toLowerCase() },
        timeout: 15000, // Increased for Cloud Run cold start
      });

      if (response.data?.grantId) {
        console.log(`[grant-resolver] Resolved grant for ${userEmail}: ${response.data.grantId.substring(0, 8)}...`);
        return response.data.grantId;
      }
    } catch (error: any) {
      console.warn(`[grant-resolver] Could not resolve grant for ${userEmail}, falling back to company default:`, error.message);
    }
  }

  // Try company default grant
  const companyGrantId = await getApiKey(companyId, 'nylas_grant_id');
  if (companyGrantId) {
    console.log(`[grant-resolver] Using company default grant: ${companyGrantId.substring(0, 8)}...`);
    return companyGrantId;
  }

  // Fall back to V3's default grant (NYLAS_GRANT_ID secret)
  // This calls V3 without a grantId, which will use V3's env default
  console.log('[grant-resolver] No company grant found, using V3 default grant');

  // V3 will use its default grant when grantId is not provided
  // Return empty string to indicate "use V3 default"
  return '';
}
