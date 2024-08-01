/// file_path: /src/helpers/assistant/functionFactory.ts
import OpenAI from 'openai';
import { IEventRequestBody } from '../../Interfaces/eventRequest.interface';
import { Assistant } from '../../models/Assistant';
import { getOpenAIClient } from '../../services/assistant.service';
import { addMessageToInbox } from '../../services/inbox.service';
import { publishMessage } from '../../services/pusher.service';
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from '../../services/google.calendar.service';

type FunctionName = keyof typeof functionFactory;

type FunctionDefinition = {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  function: (...args: any[]) => Promise<any>;
};

export const functionFactory: Record<string, FunctionDefinition> = {
  sendMessageToInbox: {
    description: 'Send a message to the inbox',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the current session',
        },
        message: {
          type: 'string',
          description: 'The message to send to the inbox',
        },
      },
      required: ['message'],
    },
    function: async (args: { sessionId?: string; message: string }) => {
      if (!args.sessionId) {
        return {
          success: false,
          description:
            'Session ID is not provided. Please ask the user for it.',
        };
      }

      try {
        await addMessageToInbox({
          sessionId: args.sessionId,
          message: args.message,
          type: 'human_agent_request',
        });
        console.log(
          `Message sent to inbox: ${args.message}, sessionId: ${args.sessionId}`,
        );
        return {
          success: true,
          description: 'Message sent to inbox',
        };
      } catch (error) {
        console.error('Error sending message to inbox:', error);

        // Check if the error is due to an invalid session ID
        if (
          (error as any).name === 'CastError' &&
          (error as any).path === '_id'
        ) {
          return {
            success: false,
            description:
              'Invalid session ID. Could you please share your session ID?',
          };
        }

        return {
          success: false,
          description: 'Failed to send message to inbox',
        };
      }
    },
  },
  getAssistants: {
    description: 'Get a list of all assistants',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      const assistants = await Assistant.find(
        {},
        { _id: 1, name: 1, description: 1 },
      );
      return assistants;
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
    function: async (args: { _id: string }) => {
      console.log('called setAssistant with args: ', args);

      publishMessage('sb', 'setAssistant', {
        _id: args._id,
      });

      return {
        success: true,
        description: `set assistant to ${args._id}`,
      };
    },
  },

  createNewAssistant: {
    description: 'Create a new assistant',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the new assistant',
        },
        description: {
          type: 'string',
          description: 'A description of the new assistant',
        },
        prompt: {
          type: 'string',
          description: 'The initial prompt for the new assistant',
        },
      },
      required: ['name', 'description', 'prompt'],
    },
    function: async (args: {
      name: string;
      description: string;
      prompt: string;
    }) => {
      console.log('called createNewAssistant with args: ', args);

      publishMessage('sb', 'createNewAssistant', {
        name: args.name,
        description: args.description,
        prompt: args.prompt,
      });

      return {
        succes: true,
        description: 'created new assistant',
      };
    },
  },
  createEvent: {
    description: 'Create a new calendar event',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'The title of the event' },
        description: {
          type: 'string',
          description: 'The description of the event',
        },
        start: {
          type: 'string',
          description: 'The start time of the event (ISO 8601 format)',
        },
        end: {
          type: 'string',
          description: 'The end time of the event (ISO 8601 format)',
        },
        // Add other properties as needed
      },
      required: ['summary', 'start', 'end'],
    },
    function: async (args: IEventRequestBody) => {
      console.log('called createEvent with args: ', args);
      const eventCreationResponse = await createEvent(args);
      return eventCreationResponse;
    },
  },
  updateEvent: {
    description: 'Update an existing calendar event',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The ID of the event to update' },
        eventData: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'The updated title of the event',
            },
            description: {
              type: 'string',
              description: 'The updated description of the event',
            },
            start: {
              type: 'string',
              description:
                'The updated start time of the event (ISO 8601 format)',
            },
            end: {
              type: 'string',
              description:
                'The updated end time of the event (ISO 8601 format)',
            },
            // Add other properties as needed
          },
        },
      },
      required: ['id', 'eventData'],
    },
    function: async (args: { id: string; eventData: IEventRequestBody }) => {
      console.log('called updateEvent with args: ', args);
      const updateResponse = await updateEvent(args.id, args.eventData);
      return updateResponse;
    },
  },
  deleteEvent: {
    description: 'Delete a calendar event',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The ID of the event to delete' },
      },
      required: ['id'],
    },
    function: async (args: { id: string }) => {
      console.log('called deleteEvent with args: ', args);
      const deleteResponse = await deleteEvent(args.id);
      return deleteResponse;
    },
  },
};

export const executeFunctionCall = async (call: any) => {
  const functionName = call.function.name as keyof typeof functionFactory;

  if (functionName in functionFactory) {
    const args = JSON.parse(call.function.arguments);
    return await functionFactory[functionName].function(args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};

export const submitToolOutputs = async (
  openaiClient: OpenAI,
  threadId: string,
  runId: string,
  toolCalls: any[],
) => {
  console.log('called submitToolOutputs with args: ', toolCalls);

  const outputs = await Promise.all(
    toolCalls.map(async (call) => {
      const output = await executeFunctionCall(call);
      return {
        tool_call_id: call.id,
        output: JSON.stringify(output),
      };
    }),
  );

  console.log('tool outputs: ', outputs);
  await openaiClient.beta.threads.runs.submitToolOutputs(threadId, runId, {
    tool_outputs: outputs,
  });
};
