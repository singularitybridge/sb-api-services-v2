import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor'; // Import the new executor
import {
  getAssistants as getAssistantsService,
  setAssistant as setAssistantService,
  createNewAssistant as createNewAssistantService,
  getCurrentAssistant as getCurrentAssistantService,
  updateAssistantById as updateAssistantByIdService,
  askAnotherAssistant as askAnotherAssistantService,
  getTeams as getTeamsService,
  getAssistantsByTeam as getAssistantsByTeamService,
  getAssistantById as getAssistantByIdService, // Import the new service function
} from './assistant.service';
import { IAssistant, IIdentifier } from '../../models/Assistant';
import { ITeam } from '../../models/Team';

// Define data types for StandardActionResult payloads
type GetAssistantsData = IAssistant[];
type SetAssistantData = { message: string };
type CreateNewAssistantData = IAssistant;
type GetCurrentAssistantData = IAssistant | null;
type UpdateAssistantData = IAssistant;
type AskAssistantData = any;
type GetTeamsData = ITeam[];
type GetAssistantsByTeamData = Partial<IAssistant>[] | IAssistant[];
type GetAssistantByIdData = IAssistant; // New data type for getAssistantById

const ASSISTANT_SERVICE_NAME = 'AssistantService';

const createAssistantActions = (context: ActionContext): FunctionFactory => ({
  getAssistants: {
    description:
      'List all AI assistants available in your company. Returns an array of assistant objects with their IDs, names, descriptions, and configuration details. Use this to discover available assistants before interacting with them.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult<GetAssistantsData>> => {
      return executeAction<GetAssistantsData>(
        'getAssistants',
        () =>
          context.isStateless
            ? getAssistantsService(context.sessionId, context.companyId)
            : getAssistantsService(context.sessionId),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistants retrieved successfully.',
          dataExtractor: (result) => result.data as GetAssistantsData,
        },
      );
    },
  },

  getAssistantById: {
    description:
      "Retrieve complete details of a specific assistant including its system prompt (llmPrompt), LLM configuration, enabled integrations, and conversation starters. Essential for reading an assistant's current prompt before modification. Returns the full assistant object with all configuration fields.",
    parameters: {
      type: 'object',
      properties: {
        assistant_id: {
          type: 'string',
          description:
            'The unique identifier of the assistant (24-character hex string, e.g., "681b41850f470a9a746f280e"). Find this using getAssistants action.',
          pattern: '^[a-f0-9]{24}$',
        },
      },
      required: ['assistant_id'],
    },
    function: async ({
      assistant_id,
    }: {
      assistant_id: string;
    }): Promise<StandardActionResult<GetAssistantByIdData>> => {
      return executeAction<GetAssistantByIdData>(
        'getAssistantById',
        () => getAssistantByIdService(context.sessionId, assistant_id),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant information retrieved successfully.',
          dataExtractor: (result) => result.data as GetAssistantByIdData,
        },
      );
    },
  },

  setCurrentSessionAssistant: {
    description:
      'Switch the current session to use a different assistant. This changes which assistant will handle subsequent messages in the current conversation session. Does not modify the assistant itself.',
    parameters: {
      type: 'object',
      properties: {
        assistant_id: {
          type: 'string',
          description:
            'The unique identifier of the assistant to activate for this session (24-character hex string)',
          pattern: '^[a-f0-9]{24}$',
        },
      },
      required: ['assistant_id'],
    },
    function: async ({
      assistant_id,
    }: {
      assistant_id: string;
    }): Promise<StandardActionResult<SetAssistantData>> => {
      return executeAction<SetAssistantData>(
        'setAssistant',
        () => setAssistantService(context.sessionId, assistant_id),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant set successfully.',
          dataExtractor: (result) => ({
            message: result.description || 'Assistant set successfully.',
          }),
        },
      );
    },
  },

  createNewAssistant: {
    description:
      'Create a new AI assistant with custom configuration. Returns the created assistant object with its generated ID.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Display name for the assistant (e.g., "Customer Support Bot", "Code Reviewer")',
          minLength: 1,
          maxLength: 100,
        },
        description: {
          type: 'string',
          description:
            "Brief description of the assistant's purpose and capabilities",
          maxLength: 500,
        },
        prompt: {
          type: 'string',
          description:
            "System prompt that defines the assistant's behavior, knowledge, and response style. This is the core instruction set.",
          minLength: 10,
          maxLength: 10000,
        },
        conversation_starters: {
          type: 'array',
          description: 'Suggested conversation starters to guide users',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Short display title (e.g., "Get Started")',
                maxLength: 50,
              },
              value: {
                type: 'string',
                description:
                  'The actual message to send when selected (e.g., "Help me understand your features")',
                maxLength: 200,
              },
            },
            required: ['key', 'value'],
          },
          maxItems: 10,
        },
      },
      required: ['name', 'description', 'prompt'],
    },
    function: async (args: {
      name: string;
      description: string;
      prompt: string;
      conversation_starters?: IIdentifier[];
    }): Promise<StandardActionResult<CreateNewAssistantData>> => {
      return executeAction<CreateNewAssistantData>(
        'createNewAssistant',
        () =>
          createNewAssistantService(
            context.sessionId,
            args.name,
            args.description,
            args.prompt,
            args.conversation_starters || [],
          ),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant created successfully.',
          dataExtractor: (result) => result.data as CreateNewAssistantData,
        },
      );
    },
  },

  getCurrentSessionAssistant: {
    description:
      'Retrieve information about the assistant currently active in this session. Returns null if no assistant is set. Useful for checking which assistant is handling the current conversation.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<
      StandardActionResult<GetCurrentAssistantData>
    > => {
      return executeAction<GetCurrentAssistantData>(
        'getCurrentAssistant',
        () => getCurrentAssistantService(context.sessionId),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Current assistant retrieved successfully.',
          dataExtractor: (result) => result.data as GetCurrentAssistantData,
        },
      );
    },
  },

  modifyAssistant: {
    description:
      "Update an existing assistant's configuration. Use this to modify prompts, change models, or update metadata. Only fields you provide will be updated (partial update). Returns the updated assistant object.",
    parameters: {
      type: 'object',
      properties: {
        assistant_id: {
          type: 'string',
          description:
            'The unique identifier of the assistant to modify (24-character hex string)',
          pattern: '^[a-f0-9]{24}$',
        },
        name: {
          type: 'string',
          description: 'New display name for the assistant',
          minLength: 1,
          maxLength: 100,
        },
        description: {
          type: 'string',
          description: 'New description of assistant capabilities',
          maxLength: 500,
        },
        llm_model: {
          type: 'string',
          description:
            'LLM model to use (e.g., "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "gemini-pro")',
        },
        llm_provider: {
          type: 'string',
          enum: ['openai', 'google', 'anthropic'],
          description: 'AI provider for the model',
        },
        llm_prompt: {
          type: 'string',
          description:
            "New system prompt defining the assistant's behavior. This is the main instruction that controls how the assistant responds.",
          minLength: 10,
          maxLength: 10000,
        },
      },
      required: ['assistant_id'],
      additionalProperties: false,
    },
    function: async (params: {
      assistant_id: string;
      name?: string;
      description?: string;
      llm_model?: string;
      llm_provider?: 'openai' | 'google' | 'anthropic';
      llm_prompt?: string;
    }): Promise<StandardActionResult<UpdateAssistantData>> => {
      const { assistant_id, ...updateData } = params;
      // Map snake_case to camelCase for service
      const mappedData: any = {};
      if (updateData.name) mappedData.name = updateData.name;
      if (updateData.description)
        mappedData.description = updateData.description;
      if (updateData.llm_model) mappedData.llmModel = updateData.llm_model;
      if (updateData.llm_provider)
        mappedData.llmProvider = updateData.llm_provider;
      if (updateData.llm_prompt) mappedData.llmPrompt = updateData.llm_prompt;
      return executeAction<UpdateAssistantData>(
        'updateAssistantById',
        () =>
          updateAssistantByIdService(
            context.sessionId,
            assistant_id,
            mappedData,
          ),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant updated successfully.',
          dataExtractor: (result) => result.data as UpdateAssistantData,
        },
      );
    },
  },

  executeAssistantQuery: {
    description:
      "Send a query to another assistant and get its response. Use this to test an assistant after modifying its prompt, or to delegate specialized tasks to domain-specific assistants. Returns the assistant's text response.",
    parameters: {
      type: 'object',
      properties: {
        assistant_id: {
          type: 'string',
          description: 'The unique identifier of the target assistant to query',
          pattern: '^[a-f0-9]{24}$',
        },
        message: {
          type: 'string',
          description:
            'The message or task description to send to the assistant. Be specific and clear about what you need.',
          minLength: 1,
          maxLength: 5000,
        },
      },
      required: ['assistant_id', 'message'],
      additionalProperties: false,
    },
    function: async ({
      assistant_id,
      message,
    }: {
      assistant_id: string;
      message: string;
    }): Promise<StandardActionResult<AskAssistantData>> => {
      return executeAction<AskAssistantData>(
        'askAssistant',
        () =>
          context.isStateless
            ? askAnotherAssistantService(
                context.sessionId,
                assistant_id,
                message,
                context.companyId,
                context.userId,
              )
            : askAnotherAssistantService(
                context.sessionId,
                assistant_id,
                message,
              ),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Task delegated successfully.',
          dataExtractor: (result) => result.data, // Data is 'any' here
        },
      );
    },
  },

  listTeams: {
    description:
      'Retrieve all teams within your company. Teams are used to organize assistants into groups. Returns an array of team objects with their IDs and names.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult<GetTeamsData>> => {
      // Note: getTeamsService might already throw or return a structure that executeAction handles.
      // If getTeamsService directly throws on error and returns { data: ... } on success,
      // the executeAction can simplify this further.
      // For now, assuming it returns { success: boolean, data: ..., description?: string }
      return executeAction<GetTeamsData>(
        'getTeams',
        async () => {
          // If getTeamsService throws on error and returns data directly on success:
          // const teamData = await getTeamsService(context.sessionId);
          // return { success: true, data: teamData, description: 'Teams retrieved successfully.' };
          // If it returns { success, data, description }
          return context.isStateless
            ? getTeamsService(context.sessionId, context.companyId)
            : getTeamsService(context.sessionId);
        },
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Teams retrieved successfully.',
          dataExtractor: (result) => result.data, // Assuming result.data is ITeam[]
        },
      );
    },
  },

  listTeamAssistants: {
    description:
      'List all assistants belonging to a specific team. Useful for discovering assistants organized by department or function.',
    parameters: {
      type: 'object',
      properties: {
        team_id: {
          type: 'string',
          description: 'The unique identifier of the team',
          pattern: '^[a-f0-9]{24}$',
        },
        lean: {
          type: 'boolean',
          description:
            'If true, returns only essential fields (ID, name, description). If false, returns complete assistant objects. Default is true for performance.',
          default: true,
        },
      },
      required: ['team_id'],
    },
    function: async ({
      team_id,
      lean = true,
    }: {
      team_id: string;
      lean?: boolean;
    }): Promise<StandardActionResult<GetAssistantsByTeamData>> => {
      return executeAction<GetAssistantsByTeamData>(
        'getAssistantsByTeam',
        () =>
          context.isStateless
            ? getAssistantsByTeamService(
                context.sessionId,
                team_id,
                lean,
                context.companyId,
              )
            : getAssistantsByTeamService(context.sessionId, team_id, lean),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistants for team retrieved successfully.',
          dataExtractor: (result) => result.data,
        },
      );
    },
  },
});

export { createAssistantActions };
