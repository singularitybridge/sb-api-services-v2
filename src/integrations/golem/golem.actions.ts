import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  createSession as createSessionService,
  sendPrompt as sendPromptService,
  getMessages as getMessagesService,
  getSession as getSessionService,
  listSessions as listSessionsService,
  validateConnection as validateConnectionService,
  cloneRepository as cloneRepositoryService,
  runApp as runAppService,
  deleteSession as deleteSessionService,
  cancelQuery as cancelQueryService,
  getStatus as getStatusService,
  checkStatus as checkStatusService,
  getAppStatus as getAppStatusService,
  GolemSession,
  GolemMessage,
  GolemStatus,
  GolemRequestStatus,
  GolemAppStatus,
} from './golem.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { TestConnectionResult } from '../../services/integration-config.service';

/**
 * Validate Golem connection
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  return validateConnectionService(apiKeys);
}

// Argument types
interface CreateSessionArgs {
  sandboxUrl?: string;
}

interface SendPromptArgs {
  sandboxUrl?: string;
  sessionId: string;
  prompt: string;
  model?: string;
}

interface GetMessagesArgs {
  sandboxUrl?: string;
  sessionId: string;
}

interface GetSessionArgs {
  sandboxUrl?: string;
  sessionId: string;
}

interface ListSessionsArgs {
  sandboxUrl?: string;
}

interface CloneRepoArgs {
  sandboxUrl?: string;
  sessionId: string;
  repoUrl: string;
  branch?: string;
}

interface RunAppArgs {
  sandboxUrl?: string;
  sessionId: string;
  appDirectory: string;
  command?: string;
}

interface DeleteSessionArgs {
  sandboxUrl?: string;
  sessionId: string;
}

interface CancelQueryArgs {
  sandboxUrl?: string;
  sessionId: string;
}

interface CheckStatusArgs {
  sandboxUrl?: string;
  sessionId: string;
  detail?: 'minimal' | 'summary' | 'full';
  lastN?: number;
}

interface GetStatusArgs {
  sandboxUrl?: string;
}

// Response data types
interface SessionResponseData {
  session: GolemSession;
}

interface PromptResponseData {
  success: boolean;
  result: any;
}

interface MessagesResponseData {
  messages: GolemMessage[];
}

interface SessionsListResponseData {
  sessions: GolemSession[];
}

interface StatusResponseData {
  status: GolemStatus;
}

interface AppStatusResponseData {
  appStatus: GolemAppStatus;
}

interface CheckStatusResponseData {
  status: GolemRequestStatus;
}

interface CancelQueryResponseData {
  status: string;
}

// Service call response type
interface ServiceCallResponse<T = any> {
  success: boolean;
  data: T;
  description?: string;
}

const SERVICE_NAME = 'Golem';

export const createGolemActions = (
  context: ActionContext,
): FunctionFactory => ({
  golemCreateSession: {
    description: 'Create a new Golem session for AI-assisted code modifications',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (
      args: CreateSessionArgs = {},
    ): Promise<StandardActionResult<SessionResponseData>> => {
      const { sandboxUrl } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<SessionResponseData, ServiceCallResponse<GolemSession>>(
        'golemCreateSession',
        async (): Promise<ServiceCallResponse<GolemSession>> => {
          const session = await createSessionService(context.companyId!, sandboxUrl);
          return { success: true, data: session };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ session: result.data }),
          successMessage: `Golem session created successfully${sandboxUrl ? ` on ${sandboxUrl}` : ''}.`,
        },
      );
    },
  },

  golemSendPrompt: {
    description: 'Send a prompt/instruction to a Golem session for code modifications. Use this to ask the AI coding agent to modify code, create files, run commands, etc.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID (returned from golemCreateSession)',
        },
        prompt: {
          type: 'string',
          description: 'The instruction/prompt to send to the AI coding agent (e.g., "Add a /cats endpoint with CRUD operations")',
        },
        model: {
          type: 'string',
          description: 'Claude model to use for this prompt. Accepts aliases ("sonnet", "opus", "haiku") or full model IDs (e.g., "claude-sonnet-4-6"). If not provided, uses the sandbox default (Sonnet).',
        },
      },
      required: ['sessionId', 'prompt'],
      additionalProperties: false,
    },
    function: async (
      args: SendPromptArgs,
    ): Promise<StandardActionResult<PromptResponseData>> => {
      const { sandboxUrl, sessionId, prompt, model } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        throw new ActionValidationError('prompt must be a non-empty string.');
      }

      return executeAction<PromptResponseData, ServiceCallResponse<PromptResponseData>>(
        'golemSendPrompt',
        async (): Promise<ServiceCallResponse<PromptResponseData>> => {
          const result = await sendPromptService(
            context.companyId!,
            sessionId.trim(),
            prompt.trim(),
            sandboxUrl,
            model?.trim(),
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          successMessage: 'Prompt sent successfully. Use golemCheckStatus to check progress. When complete, use golemGetMessages for full response.',
        },
      );
    },
  },

  golemGetMessages: {
    description: 'Get all messages from a Golem session to see the conversation history and AI responses',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    function: async (
      args: GetMessagesArgs,
    ): Promise<StandardActionResult<MessagesResponseData>> => {
      const { sandboxUrl, sessionId } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      return executeAction<MessagesResponseData, ServiceCallResponse<GolemMessage[]>>(
        'golemGetMessages',
        async (): Promise<ServiceCallResponse<GolemMessage[]>> => {
          const messages = await getMessagesService(
            context.companyId!,
            sessionId.trim(),
            sandboxUrl,
          );
          return { success: true, data: messages };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ messages: result.data }),
          successMessage: 'Messages retrieved successfully.',
        },
      );
    },
  },

  golemGetSession: {
    description: 'Get details about a specific Golem session including stats and title',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    function: async (
      args: GetSessionArgs,
    ): Promise<StandardActionResult<SessionResponseData>> => {
      const { sandboxUrl, sessionId } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      return executeAction<SessionResponseData, ServiceCallResponse<GolemSession>>(
        'golemGetSession',
        async (): Promise<ServiceCallResponse<GolemSession>> => {
          const session = await getSessionService(
            context.companyId!,
            sessionId.trim(),
            sandboxUrl,
          );
          return { success: true, data: session };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ session: result.data }),
          successMessage: 'Session details retrieved successfully.',
        },
      );
    },
  },

  golemListSessions: {
    description: 'List all Golem sessions for a specific sandbox',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (
      args: ListSessionsArgs = {},
    ): Promise<StandardActionResult<SessionsListResponseData>> => {
      const { sandboxUrl } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<SessionsListResponseData, ServiceCallResponse<GolemSession[]>>(
        'golemListSessions',
        async (): Promise<ServiceCallResponse<GolemSession[]>> => {
          const sessions = await listSessionsService(context.companyId!, sandboxUrl);
          return { success: true, data: sessions };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ sessions: result.data }),
          successMessage: `Sessions listed successfully${sandboxUrl ? ` from ${sandboxUrl}` : ''}.`,
        },
      );
    },
  },

  golemCloneRepo: {
    description: 'Deploy a GitHub repository to the Golem sandbox. Stops the current app, replaces the workspace with the cloned repo, and restarts. Uses configured GitHub token for private repos.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID (from golemCreateSession)',
        },
        repoUrl: {
          type: 'string',
          description: 'GitHub repository URL (e.g., https://github.com/org/repo)',
        },
        branch: {
          type: 'string',
          description: 'Branch to clone (optional, defaults to default branch)',
        },
      },
      required: ['sessionId', 'repoUrl'],
      additionalProperties: false,
    },
    function: async (
      args: CloneRepoArgs,
    ): Promise<StandardActionResult<PromptResponseData>> => {
      const { sandboxUrl, sessionId, repoUrl, branch } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.includes('github.com')) {
        throw new ActionValidationError('repoUrl must be a valid GitHub URL.');
      }

      return executeAction<PromptResponseData, ServiceCallResponse<PromptResponseData>>(
        'golemCloneRepo',
        async (): Promise<ServiceCallResponse<PromptResponseData>> => {
          const result = await cloneRepositoryService(
            context.companyId!,
            sessionId.trim(),
            repoUrl.trim(),
            undefined,
            branch?.trim(),
            sandboxUrl,
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          successMessage: `Repository clone initiated. Use golemCheckStatus to check progress.`,
        },
      );
    },
  },

  golemRunApp: {
    description: 'Switch the sandbox to run a different app directory. Changes to the specified directory, installs dependencies if needed, and restarts the app via PM2.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID (from golemCreateSession)',
        },
        appDirectory: {
          type: 'string',
          description: 'Full path to the app directory (e.g., /data/workspace/elal-pitch or /data/workspace for default)',
        },
        command: {
          type: 'string',
          description: 'Command to start the app (e.g., "npm start", "npm run dev"). Defaults to "npm start".',
        },
      },
      required: ['sessionId', 'appDirectory'],
      additionalProperties: false,
    },
    function: async (
      args: RunAppArgs,
    ): Promise<StandardActionResult<PromptResponseData>> => {
      const { sandboxUrl, sessionId, appDirectory, command } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      if (!appDirectory || typeof appDirectory !== 'string' || appDirectory.trim() === '') {
        throw new ActionValidationError('appDirectory must be a non-empty string.');
      }

      return executeAction<PromptResponseData, ServiceCallResponse<PromptResponseData>>(
        'golemRunApp',
        async (): Promise<ServiceCallResponse<PromptResponseData>> => {
          const result = await runAppService(
            context.companyId!,
            sessionId.trim(),
            appDirectory.trim(),
            command?.trim(),
            sandboxUrl,
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          successMessage: `App switch initiated. Use golemCheckStatus to check progress.`,
        },
      );
    },
  },

  golemDeleteSession: {
    description: 'Delete a Golem session and its conversation history',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID to delete',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    function: async (
      args: DeleteSessionArgs,
    ): Promise<StandardActionResult<{ deleted: boolean }>> => {
      const { sandboxUrl, sessionId } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      return executeAction<{ deleted: boolean }, ServiceCallResponse<void>>(
        'golemDeleteSession',
        async (): Promise<ServiceCallResponse<void>> => {
          await deleteSessionService(context.companyId!, sessionId.trim(), sandboxUrl);
          return { success: true, data: undefined as any };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: () => ({ deleted: true }),
          successMessage: `Session ${sessionId} deleted successfully.`,
        },
      );
    },
  },

  golemCancelQuery: {
    description: 'Cancel a currently running query/prompt in a Golem session. Use this to stop a long-running AI operation.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID with the running query',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    function: async (
      args: CancelQueryArgs,
    ): Promise<StandardActionResult<CancelQueryResponseData>> => {
      const { sandboxUrl, sessionId } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      return executeAction<CancelQueryResponseData, ServiceCallResponse<{ status: string }>>(
        'golemCancelQuery',
        async (): Promise<ServiceCallResponse<{ status: string }>> => {
          const result = await cancelQueryService(context.companyId!, sessionId.trim(), sandboxUrl);
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ status: result.data.status }),
          successMessage: `Query cancelled in session ${sessionId}.`,
        },
      );
    },
  },

  golemCheckStatus: {
    description: 'Check the status of a running or completed request in a Golem session. Returns processing state, progress, cost, and optionally recent output. Use after golemSendPrompt to check if the AI is done and see what it did.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox. If not provided, uses the default configured URL.',
        },
        sessionId: {
          type: 'string',
          description: 'The Golem session ID',
        },
        detail: {
          type: 'string',
          enum: ['minimal', 'summary', 'full'],
          description: 'Level of detail: "minimal" (just processing state), "summary" (state + output preview + tool calls, default), "full" (everything including messages)',
        },
        lastN: {
          type: 'number',
          description: 'When detail=full, limit to last N messages (0 = all). Useful to avoid large responses.',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    function: async (
      args: CheckStatusArgs,
    ): Promise<StandardActionResult<CheckStatusResponseData>> => {
      const { sandboxUrl, sessionId, detail, lastN } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new ActionValidationError('sessionId must be a non-empty string.');
      }

      return executeAction<CheckStatusResponseData, ServiceCallResponse<GolemRequestStatus>>(
        'golemCheckStatus',
        async (): Promise<ServiceCallResponse<GolemRequestStatus>> => {
          const status = await checkStatusService(
            context.companyId!,
            sessionId.trim(),
            detail || 'summary',
            lastN,
            sandboxUrl,
          );
          return { success: true, data: status };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ status: result.data }),
          successMessage: 'Request status retrieved successfully.',
        },
      );
    },
  },

  golemGetStatus: {
    description: 'Get the status of a Golem sandbox including auth configuration, MCP servers, volume info, and configured API keys.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox (e.g., https://my-app.fly.dev). If not provided, uses the default configured URL.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (
      args: GetStatusArgs = {},
    ): Promise<StandardActionResult<StatusResponseData>> => {
      const { sandboxUrl } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<StatusResponseData, ServiceCallResponse<GolemStatus>>(
        'golemGetStatus',
        async (): Promise<ServiceCallResponse<GolemStatus>> => {
          const status = await getStatusService(context.companyId!, sandboxUrl);
          return { success: true, data: status };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ status: result.data }),
          successMessage: `Sandbox status retrieved successfully${sandboxUrl ? ` from ${sandboxUrl}` : ''}.`,
        },
      );
    },
  },

  golemGetAppStatus: {
    description: 'Check if the user\'s app is running and healthy in the Golem sandbox. Returns HTTP reachability and PM2 process info (restarts, uptime).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sandboxUrl: {
          type: 'string',
          description: 'URL of the Golem sandbox. If not provided, uses the default configured URL.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (
      args: GetStatusArgs = {},
    ): Promise<StandardActionResult<AppStatusResponseData>> => {
      const { sandboxUrl } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<AppStatusResponseData, ServiceCallResponse<GolemAppStatus>>(
        'golemGetAppStatus',
        async (): Promise<ServiceCallResponse<GolemAppStatus>> => {
          const appStatus = await getAppStatusService(context.companyId!, sandboxUrl);
          return { success: true, data: appStatus };
        },
        {
          serviceName: SERVICE_NAME,
          dataExtractor: (result) => ({ appStatus: result.data }),
          successMessage: 'App status retrieved successfully.',
        },
      );
    },
  },
});
