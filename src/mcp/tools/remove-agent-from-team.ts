/**
 * Remove Agent from Team Tool
 *
 * Removes an agent from a team
 */

import { z } from 'zod';
import {
  getTeamById,
  removeAssistantFromTeam,
} from '../../services/team.service';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the remove_agent_from_team tool
 */
export const removeAgentFromTeamSchema = z.object({
  agentId: z
    .string()
    .describe('Agent ID, name, or URL to remove from the team'),
  teamId: z.string().describe('The ID of the team to remove the agent from'),
});

export type RemoveAgentFromTeamInput = z.infer<
  typeof removeAgentFromTeamSchema
>;

/**
 * Remove an agent from a team
 */
export async function removeAgentFromTeam(
  input: RemoveAgentFromTeamInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Verify team exists and belongs to the company
    const team = await getTeamById(input.teamId);
    if (!team) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Team not found: ${input.teamId}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (team.companyId.toString() !== companyId) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: 'Access denied: Team belongs to a different company',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

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

    // Remove the agent from the team
    await removeAssistantFromTeam(agent._id.toString(), input.teamId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Agent "${agent.name}" removed from team "${team.name}"`,
              agent: {
                id: agent._id.toString(),
                name: agent.name,
              },
              team: {
                id: team._id.toString(),
                name: team.name,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP remove agent from team error:', error);

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
                  : 'Failed to remove agent from team',
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
export const removeAgentFromTeamTool = {
  name: 'remove_agent_from_team',
  description:
    'Remove an agent from a team. The agent can be specified by ID, name, or URL.',
  inputSchema: removeAgentFromTeamSchema,
};
