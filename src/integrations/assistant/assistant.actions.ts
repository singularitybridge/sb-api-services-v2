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

const ASSISTANT_SERVICE_NAME = 'AssistantService';

const createAssistantActions = (context: ActionContext): FunctionFactory => ({
  getAssistants: {
    description: "Get a list of all assistants for the current user's company",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult<GetAssistantsData>> => {
      return executeAction<GetAssistantsData>(
        'getAssistants',
        () => getAssistantsService(context.sessionId),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistants retrieved successfully.',
          dataExtractor: (result) => result.data as GetAssistantsData,
        },
      );
    },
  },

  setAssistant: {
    description: 'Set the current assistant',
    parameters: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'The ID of the assistant to set',
        },
      },
      required: ['_id'],
    },
    function: async ({
      _id,
    }: {
      _id: string;
    }): Promise<StandardActionResult<SetAssistantData>> => {
      return executeAction<SetAssistantData>(
        'setAssistant',
        () => setAssistantService(context.sessionId, _id),
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
    description: 'Create a new assistant',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the new assistant' },
        description: {
          type: 'string',
          description: 'A description of the new assistant',
        },
        prompt: {
          type: 'string',
          description: 'The initial prompt for the new assistant',
        },
        language: {
          type: 'string',
          description: 'The language of the assistant, can be he or en',
        },
        voice: { type: 'string', description: 'The voice of the assistant' },
        conversationStarters: {
          type: 'array',
          description: 'Array of conversation starters with title and content',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'The title of the conversation starter',
              },
              value: {
                type: 'string',
                description: 'The content of the conversation starter',
              },
            },
            required: ['key', 'value'],
          },
        },
      },
      required: ['name', 'description', 'prompt', 'language', 'voice'],
    },
    function: async (args: {
      name: string;
      description: string;
      prompt: string;
      language: string;
      voice: string;
      conversationStarters?: IIdentifier[];
    }): Promise<StandardActionResult<CreateNewAssistantData>> => {
      return executeAction<CreateNewAssistantData>(
        'createNewAssistant',
        () =>
          createNewAssistantService(
            context.sessionId,
            args.name,
            args.description,
            args.prompt,
            args.language,
            args.voice,
            args.conversationStarters || [],
          ),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant created successfully.',
          dataExtractor: (result) => result.data as CreateNewAssistantData,
        },
      );
    },
  },

  getCurrentAssistant: {
    description: "Get the current assistant's information for the session",
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

  updateAssistantById: {
    description:
      'Update a specific assistant by ID with new information. Only provided fields will be updated.',
    parameters: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'The ID of the assistant to update',
        },
        name: {
          type: 'string',
          description: 'New name (title) for the assistant',
        },
        description: {
          type: 'string',
          description: 'New description for the assistant',
        },
        llmModel: {
          type: 'string',
          description: 'New LLM model identifier (e.g., gpt-4.1-mini)',
        },
        llmProvider: {
          type: 'string',
          enum: ['openai', 'google', 'anthropic'],
          description: 'New LLM provider',
        },
        llmPrompt: {
          type: 'string',
          description: 'New LLM prompt for the assistant',
        },
      },
      required: ['assistantId'],
      additionalProperties: false,
    },
    function: async (params: {
      assistantId: string;
      name?: string;
      description?: string;
      llmModel?: string;
      llmProvider?: 'openai' | 'google' | 'anthropic';
      llmPrompt?: string;
    }): Promise<StandardActionResult<UpdateAssistantData>> => {
      const { assistantId, ...updateData } = params;
      return executeAction<UpdateAssistantData>(
        'updateAssistantById',
        () =>
          updateAssistantByIdService(
            context.sessionId,
            assistantId,
            updateData,
          ),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Assistant updated successfully.',
          dataExtractor: (result) => result.data as UpdateAssistantData,
        },
      );
    },
  },

  askAssistant: {
    description:
      'Ask another assistant to handle a specific task and return the response.',
    parameters: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'The ID of the target assistant to ask',
        },
        task: {
          type: 'string',
          description: 'The task or prompt to send to the target assistant',
        },
      },
      required: ['assistantId', 'task'],
      additionalProperties: false,
    },
    function: async ({
      assistantId,
      task,
    }: {
      assistantId: string;
      task: string;
    }): Promise<StandardActionResult<AskAssistantData>> => {
      return executeAction<AskAssistantData>(
        'askAssistant',
        () =>
          context.isStateless
            ? askAnotherAssistantService(
                context.sessionId,
                assistantId,
                task,
                context.companyId,
                context.userId,
              )
            : askAnotherAssistantService(context.sessionId, assistantId, task),
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Task delegated successfully.',
          dataExtractor: (result) => result.data, // Data is 'any' here
        },
      );
    },
  },

  getTeams: {
    description: "Get a list of all teams for the current user's company",
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
          return getTeamsService(context.sessionId);
        },
        {
          serviceName: ASSISTANT_SERVICE_NAME,
          successMessage: 'Teams retrieved successfully.',
          dataExtractor: (result) => result.data, // Assuming result.data is ITeam[]
        },
      );
    },
  },

  getAssistantsByTeam: {
    description: 'Get a list of assistants for a specific team',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The ID of the team' },
        lean: {
          type: 'boolean',
          description:
            'If true, returns a lean representation. Defaults to true.',
          default: true,
        },
      },
      required: ['teamId'],
    },
    function: async ({
      teamId,
      lean = true,
    }: {
      teamId: string;
      lean?: boolean;
    }): Promise<StandardActionResult<GetAssistantsByTeamData>> => {
      return executeAction<GetAssistantsByTeamData>(
        'getAssistantsByTeam',
        () => getAssistantsByTeamService(context.sessionId, teamId, lean),
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
