import axios from 'axios';
import { getApiKey, setApiKey } from '../../services/api.key.service';

interface ProvisionEnvironmentData {
  customerId: string;
  apiKey: string;
  tunnelUrl: string;
  machineId: string;
}

export class TerminalTurtleService {
  private static readonly HARDCODED_FLY_API_TOKEN = 'fly_hardcoded_token_phase1';
  private static readonly HARDCODED_ORCHESTRATOR_URL = 'https://orchestrator.ai-programmer.com';
  private static readonly HARDCODED_ORCHESTRATOR_API_KEY = 'orchestrator_hardcoded_key_phase1';

  static async provisionEnvironment(companyId: string): Promise<ProvisionEnvironmentData> {
    // For Phase 1, we're using hardcoded values
    // Later these will be replaced with actual API keys from the company
    
    const response = await axios.post(
      `${this.HARDCODED_ORCHESTRATOR_URL}/api/customers/${companyId}/provision`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${this.HARDCODED_ORCHESTRATOR_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to provision environment');
    }

    const { customerId, apiKey, tunnelUrl, machineId } = response.data.data;

    // Store the generated credentials
    await setApiKey(companyId, 'TERMINAL_TURTLE_API_KEY', apiKey);
    await setApiKey(companyId, 'TERMINAL_TURTLE_URL', tunnelUrl);

    return {
      customerId,
      apiKey,
      tunnelUrl,
      machineId
    };
  }

  static async getEnvironmentInfo(companyId: string): Promise<{ apiKey: string; url: string }> {
    const apiKey = await getApiKey(companyId, 'TERMINAL_TURTLE_API_KEY');
    const url = await getApiKey(companyId, 'TERMINAL_TURTLE_URL');

    if (!apiKey || !url) {
      throw new Error('Environment not provisioned. Run provisionEnvironment first.');
    }

    return { apiKey, url };
  }

  static async executeOnFlyMachine(
    companyId: string,
    endpoint: string,
    data: any,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const { apiKey, url } = await this.getEnvironmentInfo(companyId);

    const config = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (method === 'GET') {
      return axios.get(`${url}${endpoint}`, config);
    } else {
      return axios.post(`${url}${endpoint}`, data, config);
    }
  }
}