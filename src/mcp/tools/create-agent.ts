/**
 * Create Agent Tool
 *
 * Creates a new AI assistant/agent for the authenticated company
 */

import { z } from 'zod';
import { Assistant } from '../../models/Assistant';

/**
 * Input schema for the create_agent tool
 */
export const createAgentSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z
    .string()
    .optional()
    .describe("Description of the agent's purpose"),
  llmProvider: z
    .enum(['openai', 'google', 'anthropic', 'openrouter'])
    .describe('LLM provider (openai, google, anthropic, or openrouter)'),
  llmModel: z
    .string()
    .describe(
      'LLM model name (e.g., gpt-5.1, claude-sonnet-4-20250514, gemini-2.0-flash)',
    ),
  llmPrompt: z.string().optional().describe('System prompt for the agent'),
  maxTokens: z
    .number()
    .optional()
    .describe('Maximum tokens for the model (default: 25000)'),
  teamIds: z
    .array(z.string())
    .optional()
    .describe('Array of team IDs to assign the agent to'),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

/**
 * Create a new agent
 */
export async function createAgent(
  input: CreateAgentInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const agent = new Assistant({
      name: input.name,
      description: input.description || '',
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      llmPrompt: input.llmPrompt || '',
      maxTokens: input.maxTokens || 25000,
      companyId,
      allowedActions: [],
      conversationStarters: [],
      teams: input.teamIds || [],
    });

    await agent.save();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              agent: {
                id: agent._id.toString(),
                name: agent.name,
                description: agent.description,
                llmProvider: agent.llmProvider,
                llmModel: agent.llmModel,
                maxTokens: agent.maxTokens,
                teams: agent.teams?.map((t) => t.toString()) || [],
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP create agent error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to create agent',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const createAgentTool = {
  name: 'create_agent',
  description:
    'Create a new AI agent/assistant with specified LLM provider and model. Returns the created agent details including ID.',
  inputSchema: createAgentSchema,
};
