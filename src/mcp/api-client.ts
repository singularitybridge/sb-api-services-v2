/**
 * API Client for Singularity Bridge API
 *
 * Provides authenticated HTTP client for making requests to the API
 */

import { MCPConfig } from './config.js';

export class APIClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: MCPConfig, apiKey?: string) {
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = apiKey || config.apiKey;
  }

  /**
   * Execute an AI assistant with a prompt
   */
  async executeAssistant(params: {
    assistantId: string;
    userInput: string;
    sessionId?: string;
    systemPromptOverride?: string;
    attachments?: Array<{
      type: 'url' | 'base64';
      data: string;
      mimeType?: string;
    }>;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/assistants/${params.assistantId}/execute`;

    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userInput: params.userInput,
        sessionId: params.sessionId,
        systemPromptOverride: params.systemPromptOverride,
        attachments: params.attachments,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * List all available assistants
   */
  async listAssistants(): Promise<any> {
    const url = `${this.baseUrl}/api/assistants`;

    const headers: any = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Get assistant details by ID
   */
  async getAssistant(assistantId: string): Promise<any> {
    const url = `${this.baseUrl}/api/assistants/${assistantId}`;

    const headers: any = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    return response.json();
  }
}
