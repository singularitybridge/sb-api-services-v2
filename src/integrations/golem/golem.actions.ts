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
  GolemSession,
  GolemMessage,
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
  targetDir?: string;
  branch?: string;
}

interface RunAppArgs {
  sandboxUrl?: string;
  sessionId: string;
  appDirectory: string;
  command?: string;
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
      },
      required: ['sessionId', 'prompt'],
      additionalProperties: false,
    },
    function: async (
      args: SendPromptArgs,
    ): Promise<StandardActionResult<PromptResponseData>> => {
      const { sandboxUrl, sessionId, prompt } = args;

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
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          successMessage: 'Prompt sent successfully. Use golemGetMessages to check the response.',
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
    description: 'Clone a GitHub repository into the Golem workspace. Uses configured GitHub token for private repos. Automatically runs npm install if package.json exists.',
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
        targetDir: {
          type: 'string',
          description: 'Target directory name in /data/workspace/ (optional, defaults to repo name)',
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
      const { sandboxUrl, sessionId, repoUrl, targetDir, branch } = args;

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
            targetDir?.trim(),
            branch?.trim(),
            sandboxUrl,
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          successMessage: `Repository clone initiated. Use golemGetMessages to check progress.`,
        },
      );
    },
  },

  golemRunApp: {
    description: 'Switch the sandbox to run a different app. Updates /data/active-app.json and restarts the app process. Use this after cloning a repo to run it instead of the default app.',
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
          successMessage: `App switch initiated. Use golemGetMessages to check the result.`,
        },
      );
    },
  },
});
