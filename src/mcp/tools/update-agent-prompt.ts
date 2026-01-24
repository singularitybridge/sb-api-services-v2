/**
 * Update Agent Prompt Tool
 *
 * Updates the system prompt for a specific agent (supports ID or name)
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { Assistant } from '../../models/Assistant';
import promptHistoryService from '../../services/prompt-history.service';

/**
 * Input schema for the update_agent_prompt tool
 */
export const updateAgentPromptSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to update (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
  prompt: z
    .string()
    .describe('The new system prompt/instructions for the agent'),
});

export type UpdateAgentPromptInput = z.infer<typeof updateAgentPromptSchema>;

/**
 * Update an agent's system prompt
 */
export async function updateAgentPrompt(
  input: UpdateAgentPromptInput,
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

    // Update the prompt
    agent.llmPrompt = input.prompt;
    await agent.save();

    // Save to prompt history
    try {
      await promptHistoryService.savePromptVersion({
        assistantId: agent._id.toString(),
        companyId,
        promptContent: input.prompt,
        changeType: 'update',
        changeDescription: 'Prompt updated via MCP',
      });
    } catch (historyError) {
      console.error('Failed to save prompt history:', historyError);
      // Don't fail the update if history save fails
    }

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
              },
              prompt: agent.llmPrompt,
              message: 'Agent prompt updated successfully',
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP update agent prompt error:', error);

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
                  : 'Failed to update agent prompt',
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
export const updateAgentPromptTool = {
  name: 'update_agent_prompt',
  description:
    "Update the system prompt for a specific AI agent. Supports lookup by agent ID or name. Modifies the agent's system instructions/prompt.",
  inputSchema: updateAgentPromptSchema,
};
