/**
 * Update Agent Tool
 *
 * Updates core metadata fields for a specific agent (name, description, prompt, model, provider)
 * Supports lookup by agent ID or name
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the update_agent tool
 */
export const updateAgentSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to update (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
  name: z.string().optional().describe('New name for the agent'),
  description: z
    .string()
    .optional()
    .describe("New description of the agent's purpose"),
  prompt: z
    .string()
    .optional()
    .describe('New system prompt/instructions for the agent'),
  llmProvider: z
    .enum(['openai', 'google', 'anthropic'])
    .optional()
    .describe('LLM provider (openai, google, or anthropic)'),
  llmModel: z
    .string()
    .optional()
    .describe(
      'LLM model name (e.g., gpt-4o-mini, claude-sonnet-4-20250514, gemini-2.0-flash)',
    ),
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

/**
 * Update an agent's metadata
 */
export async function updateAgent(
  input: UpdateAgentInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Resolve agent by ID or name
    const agent = await resolveAssistantIdentifier(input.agentId, companyId);

    if (!agent) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Agent not found: ${input.agentId}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Track what fields are being updated
    const updates: string[] = [];

    // Update only the provided fields
    if (input.name !== undefined) {
      agent.name = input.name;
      updates.push('name');
    }

    if (input.description !== undefined) {
      agent.description = input.description;
      updates.push('description');
    }

    if (input.prompt !== undefined) {
      agent.llmPrompt = input.prompt;
      updates.push('prompt');
    }

    if (input.llmProvider !== undefined) {
      agent.llmProvider = input.llmProvider;
      updates.push('llmProvider');
    }

    if (input.llmModel !== undefined) {
      agent.llmModel = input.llmModel;
      updates.push('llmModel');
    }

    // Save the agent if any updates were made
    if (updates.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'No fields provided to update',
                agentId: input.agentId,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

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
                prompt: agent.llmPrompt,
              },
              updatedFields: updates,
              message: `Agent updated successfully (${updates.join(', ')})`,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP update agent error:', error);

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
                  : 'Failed to update agent',
              agentId: input.agentId,
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
export const updateAgentTool = {
  name: 'update_agent',
  description:
    "Update an AI agent's core metadata including name, description, system prompt, LLM provider, and LLM model. Supports lookup by agent ID or name. Only updates the fields provided.",
  inputSchema: updateAgentSchema,
};
