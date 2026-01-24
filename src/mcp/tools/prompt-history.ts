/**
 * Prompt History Tools
 *
 * MCP tools for viewing and managing prompt version history.
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import promptHistoryService from '../../services/prompt-history.service';

/**
 * Input schema for the list_prompt_history tool
 */
export const listPromptHistorySchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent to get prompt history for (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of versions to return (default: 10)'),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe('Number of versions to skip for pagination (default: 0)'),
});

export type ListPromptHistoryInput = z.infer<typeof listPromptHistorySchema>;

/**
 * List prompt history versions for an agent
 */
export async function listPromptHistory(
  input: ListPromptHistoryInput,
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

    const result = await promptHistoryService.getPromptHistory({
      assistantId: agent._id.toString(),
      companyId,
      limit: input.limit,
      offset: input.offset,
    });

    // Format the history for readability
    const formattedHistory = result.history.map((entry) => ({
      version: entry.version,
      changeType: entry.changeType,
      changeDescription: entry.changeDescription,
      promptLength: entry.promptContent.length,
      createdAt: entry.createdAt,
      // Include first 200 chars of prompt as preview
      promptPreview:
        entry.promptContent.length > 200
          ? entry.promptContent.substring(0, 200) + '...'
          : entry.promptContent,
    }));

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
              },
              history: formattedHistory,
              pagination: {
                total: result.total,
                limit: input.limit,
                offset: input.offset,
                hasMore: result.hasMore,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list prompt history error:', error);

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
                  : 'Failed to list prompt history',
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
 * Input schema for the get_prompt_version tool
 */
export const getPromptVersionSchema = z.object({
  agentId: z
    .string()
    .describe(
      'The ID or name of the agent (e.g., "681b41850f470a9a746f280e" or "workspace-agent")',
    ),
  version: z.number().describe('The version number to retrieve'),
});

export type GetPromptVersionInput = z.infer<typeof getPromptVersionSchema>;

/**
 * Get a specific prompt version
 */
export async function getPromptVersion(
  input: GetPromptVersionInput,
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

    const promptVersion = await promptHistoryService.getPromptByVersion(
      agent._id.toString(),
      input.version,
    );

    if (!promptVersion) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Version ${input.version} not found for agent ${agent.name}`,
              },
              null,
              2,
            ),
          },
        ],
      };
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
              },
              promptVersion: {
                version: promptVersion.version,
                changeType: promptVersion.changeType,
                changeDescription: promptVersion.changeDescription,
                promptContent: promptVersion.promptContent,
                promptLength: promptVersion.promptContent.length,
                previousVersion: promptVersion.previousVersion,
                createdAt: promptVersion.createdAt,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get prompt version error:', error);

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
                  : 'Failed to get prompt version',
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
export const listPromptHistoryTool = {
  name: 'list_prompt_history',
  description:
    "List the version history of an agent's system prompt. Shows version numbers, change types, descriptions, and previews. Use this to see how a prompt has evolved over time.",
  inputSchema: listPromptHistorySchema,
};

export const getPromptVersionTool = {
  name: 'get_prompt_version',
  description:
    "Get the full content of a specific prompt version. Use list_prompt_history first to see available versions, then use this to retrieve the complete prompt text for a specific version.",
  inputSchema: getPromptVersionSchema,
};
