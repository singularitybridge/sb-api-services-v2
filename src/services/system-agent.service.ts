import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * System Agent Service
 * Manages system-level agents/prompts that can be reused across the application
 * Agents are stored in .agents/ directory with config.json and prompt.md files
 */

export interface SystemAgentConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  type:
    | 'text-generation'
    | 'image-generation'
    | 'audio-generation'
    | 'embedding';
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  model: string;
  config: Record<string, any>; // Provider-specific config
  parameters: Record<
    string,
    {
      type: string;
      required: boolean;
      description: string;
      default?: any;
    }
  >;
  metadata?: {
    createdAt?: string;
    category?: string;
    tags?: string[];
    cost?: {
      perRequest?: number;
      currency?: string;
      model?: string;
    };
  };
}

export interface SystemAgent {
  config: SystemAgentConfig;
  prompt: string; // Raw prompt template
  promptPath: string;
  configPath: string;
}

export interface AgentExecutionParams {
  [key: string]: any;
}

class SystemAgentService {
  private agentsCache: Map<string, SystemAgent> = new Map();
  private agentsDir: string;

  constructor() {
    // .agents directory is at project root
    this.agentsDir = path.join(process.cwd(), '.agents');
    this.loadAllAgents();
  }

  /**
   * Load all system agents from .agents directory
   */
  private loadAllAgents(): void {
    if (!fs.existsSync(this.agentsDir)) {
      logger.warn(
        'System agents directory not found, creating:',
        this.agentsDir,
      );
      fs.mkdirSync(this.agentsDir, { recursive: true });
      return;
    }

    const agentDirs = fs
      .readdirSync(this.agentsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => dirent.name.startsWith('sys-')); // Only load system agents

    logger.info(
      `Loading ${agentDirs.length} system agents from ${this.agentsDir}`,
    );

    for (const dirent of agentDirs) {
      try {
        const agentId = dirent.name;
        const agent = this.loadAgent(agentId);
        if (agent) {
          this.agentsCache.set(agentId, agent);
          logger.info(`Loaded system agent: ${agentId} (${agent.config.name})`);
        }
      } catch (error) {
        logger.error(`Failed to load agent ${dirent.name}:`, error);
      }
    }
  }

  /**
   * Load a single agent from disk
   */
  private loadAgent(agentId: string): SystemAgent | null {
    const agentPath = path.join(this.agentsDir, agentId);
    const configPath = path.join(agentPath, 'config.json');
    const promptPath = path.join(agentPath, 'prompt.md');

    // Validate files exist
    if (!fs.existsSync(configPath)) {
      logger.error(`Agent config not found: ${configPath}`);
      return null;
    }

    if (!fs.existsSync(promptPath)) {
      logger.error(`Agent prompt not found: ${promptPath}`);
      return null;
    }

    // Load config
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config: SystemAgentConfig = JSON.parse(configRaw);

    // Load prompt template
    const prompt = fs.readFileSync(promptPath, 'utf-8');

    return {
      config,
      prompt,
      promptPath,
      configPath,
    };
  }

  /**
   * Get a system agent by ID
   */
  getAgent(agentId: string): SystemAgent | null {
    // Check cache first
    if (this.agentsCache.has(agentId)) {
      return this.agentsCache.get(agentId)!;
    }

    // Try to load from disk
    const agent = this.loadAgent(agentId);
    if (agent) {
      this.agentsCache.set(agentId, agent);
    }

    return agent;
  }

  /**
   * Get all system agents
   */
  getAllAgents(): SystemAgent[] {
    return Array.from(this.agentsCache.values());
  }

  /**
   * Reload a specific agent from disk (useful for hot-reloading)
   */
  reloadAgent(agentId: string): SystemAgent | null {
    const agent = this.loadAgent(agentId);
    if (agent) {
      this.agentsCache.set(agentId, agent);
      logger.info(`Reloaded system agent: ${agentId}`);
    }
    return agent;
  }

  /**
   * Reload all agents from disk
   */
  reloadAllAgents(): void {
    this.agentsCache.clear();
    this.loadAllAgents();
    logger.info('Reloaded all system agents');
  }

  /**
   * Generate a prompt from template with parameter substitution
   */
  generatePrompt(agentId: string, params: AgentExecutionParams): string {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`System agent not found: ${agentId}`);
    }

    // Validate required parameters
    for (const [paramName, paramConfig] of Object.entries(
      agent.config.parameters,
    )) {
      if (paramConfig.required && !(paramName in params)) {
        throw new Error(`Required parameter missing: ${paramName}`);
      }
    }

    // Simple template substitution using {{paramName}} syntax
    let prompt = agent.prompt;

    // Handle special styleIndex parameter for multi-variation prompts
    if ('styleIndex' in params) {
      const styleIndex = params.styleIndex || 0;
      // Extract style variations from prompt.md
      const styleMatch = prompt.match(
        /### Style (\d+):(.*?)(?=###|\n---|\n##|$)/g,
      );
      if (styleMatch && styleMatch[styleIndex]) {
        const styleDesc = styleMatch[styleIndex]
          .replace(/### Style \d+:\s*/, '')
          .trim();
        prompt = prompt.replace('{{styleVariation}}', styleDesc);
      }
    }

    // Replace all {{paramName}} with actual values
    for (const [key, value] of Object.entries(params)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(regex, String(value));
    }

    // Extract the actual prompt (remove examples and documentation)
    // Look for "## Base Prompt Structure" or similar sections
    const baseSectionMatch = prompt.match(
      /## Base Prompt Structure\n\n([\s\S]*?)(?=\n---|\n##|$)/,
    );
    if (baseSectionMatch) {
      prompt = baseSectionMatch[1].trim();
    }

    return prompt;
  }

  /**
   * Validate agent configuration
   */
  validateAgent(agentId: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const agent = this.getAgent(agentId);

    if (!agent) {
      return { valid: false, errors: ['Agent not found'] };
    }

    // Validate required config fields
    if (!agent.config.id) errors.push('Missing config.id');
    if (!agent.config.name) errors.push('Missing config.name');
    if (!agent.config.type) errors.push('Missing config.type');
    if (!agent.config.provider) errors.push('Missing config.provider');
    if (!agent.config.model) errors.push('Missing config.model');

    // Validate prompt exists and is not empty
    if (!agent.prompt || agent.prompt.trim().length === 0) {
      errors.push('Prompt is empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get agent metadata (useful for UI/admin panels)
   */
  getAgentMetadata(agentId: string): SystemAgentConfig | null {
    const agent = this.getAgent(agentId);
    return agent ? agent.config : null;
  }

  /**
   * List all agents by category
   */
  getAgentsByCategory(category: string): SystemAgent[] {
    return this.getAllAgents().filter(
      (agent) => agent.config.metadata?.category === category,
    );
  }

  /**
   * List all agents by type
   */
  getAgentsByType(type: SystemAgentConfig['type']): SystemAgent[] {
    return this.getAllAgents().filter((agent) => agent.config.type === type);
  }

  /**
   * Search agents by tag
   */
  getAgentsByTag(tag: string): SystemAgent[] {
    return this.getAllAgents().filter((agent) =>
      agent.config.metadata?.tags?.includes(tag),
    );
  }
}

// Singleton instance
let systemAgentService: SystemAgentService | null = null;

export const getSystemAgentService = (): SystemAgentService => {
  if (!systemAgentService) {
    systemAgentService = new SystemAgentService();
  }
  return systemAgentService;
};

export default { getSystemAgentService };
