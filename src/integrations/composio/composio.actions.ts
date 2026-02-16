import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  listTools as listToolsService,
  executeTool as executeToolService,
  verifyConnection as verifyConnectionService,
} from './composio.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { TestConnectionResult } from '../../services/integration-config.service';

const SERVICE_NAME = 'composioService';

export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.composio_api_key;
  const externalUserId = apiKeys.composio_external_user_id;

  if (!apiKey) {
    return {
      success: false,
      error: 'Composio API key is not configured',
    };
  }

  if (!externalUserId) {
    return {
      success: false,
      error: 'Composio external user ID is not configured',
    };
  }

  try {
    const result = await verifyConnectionService(apiKey, externalUserId);

    if (result.valid) {
      return {
        success: true,
        message: `Connected to Composio successfully (${result.toolCount} tools available)`,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to connect to Composio',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Composio',
    };
  }
}

interface ListToolsArgs {
  toolkit?: string;
}

interface ComposioToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ExecuteToolArgs {
  tool_name: string;
  arguments: Record<string, unknown>;
}

export const createComposioActions = (
  context: ActionContext,
): FunctionFactory => ({
  composioListTools: {
    description:
      'List available Composio tools. Use this to discover tools and their parameter schemas before calling composioExecuteTool. Optionally filter by toolkit (e.g. "gmail", "slack", "github").',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        toolkit: {
          type: 'string',
          description:
            'Filter tools by toolkit name (e.g. "gmail", "slack", "github"). If omitted, returns all available tools.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (
      args: ListToolsArgs,
    ): Promise<StandardActionResult<ComposioToolInfo[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<
        ComposioToolInfo[],
        { success: boolean; data: ComposioToolInfo[] }
      >(
        'composioListTools',
        async () => {
          const tools = await listToolsService(
            context.companyId!,
            args.toolkit,
          );
          return { success: true, data: tools };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  composioExecuteTool: {
    description:
      'Execute a specific Composio tool by name. Use composioListTools first to discover available tools and their required parameter schemas.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description:
            'The exact tool name/slug to execute (e.g. "GMAIL_FETCH_EMAILS"). Use composioListTools to discover available tool names.',
        },
        arguments: {
          type: 'object',
          description:
            'Arguments to pass to the tool. Schema varies per tool — use composioListTools to see required parameters.',
          additionalProperties: true,
        },
      },
      required: ['tool_name', 'arguments'],
      additionalProperties: false,
    },
    function: async (
      args: ExecuteToolArgs,
    ): Promise<StandardActionResult<Record<string, unknown>>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.tool_name || typeof args.tool_name !== 'string') {
        throw new ActionValidationError(
          'tool_name is required and must be a string.',
        );
      }

      if (!args.arguments || typeof args.arguments !== 'object') {
        throw new ActionValidationError(
          'arguments is required and must be an object.',
        );
      }

      return executeAction<
        Record<string, unknown>,
        { success: boolean; data: Record<string, unknown> }
      >(
        'composioExecuteTool',
        async () => {
          const result = await executeToolService(
            context.companyId!,
            args.tool_name,
            args.arguments,
          );
          return { success: true, data: result };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
