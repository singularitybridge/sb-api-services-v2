import { IEventRequestBody } from '../../Interfaces/eventRequest.interface';
import { CalendarController } from '../../controllers/calendar.controller';
import { Assistant } from '../../models/Assistant';
import { openaiClient } from '../../services/assistant.service';
import { addMessageToInbox } from '../../services/inbox.service';
import { publishMessage } from '../../services/pusher.service';

type FunctionName = keyof typeof functionFactory;
const calendarController = new CalendarController();

const functionFactory = {
  async sendMessageToInbox(args: { sessionId?: string; message: string }) {
    if (!args.sessionId) {
      return {
        success: false,
        description: 'Session ID is not provided. Please ask the user for it.',
      };
    }
  
    try {
      await addMessageToInbox({
        sessionId: args.sessionId,
        message: args.message,
      });
      console.log(`Message sent to inbox: ${args.message}, sessionId: ${args.sessionId}`);
      return {
        success: true,
        description: 'Message sent to inbox',
      };
    } catch (error) {
      console.error('Error sending message to inbox:', error);

      // Check if the error is due to an invalid session ID
      if ((error as any).name === 'ValidationError' && (error as any).errors && (error as any).errors.sessionId) {
        return {
          success: false,
          description: 'Session ID not found or invalid. Please ask the user for a valid session ID.',
        };
      }
  
      return {
        success: false,
        description: 'Failed to send message to inbox',
      };
    }
  }
  ,
  async getAssistants() {
    const assistants = await Assistant.find(
      {},
      { _id: 1, name: 1, description: 1 },
    );
    return assistants;
  },

  setAssistant(args: { _id: string }) {
    console.log('called setAssistant with args: ', args);

    publishMessage('sb', 'setAssistant', {
      _id: args._id,
    });

    return {
      succes: true,
      description: `set assistant to ${args._id}`,
    };
  },

  async createNewAssistant(args: {
    name: string;
    description: string;
    prompt: string;
  }) {
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

  async getEvents(args: { start: string; end: string }) {
    console.log('called getEvents with args: ', args);
    const events = await calendarController.getEvents(args.start, args.end);
    return events;
  },

  async getFreeSlots(args: { start: string; end: string; duration: number }) {
    console.log('called getFreeSlots with args: ', args);
    const freeSlots = await calendarController.getFreeSlots(
      args.start,
      args.end,
      args.duration,
    );
    return freeSlots;
  },

  async createEvent(args: IEventRequestBody) {
    console.log('called createEvent with args: ', args);
    const eventCreationResponse = await calendarController.createEvent(args);
    return eventCreationResponse;
  },

  async updateEvent(args: { id: string; eventData: IEventRequestBody }) {
    console.log('called updateEvent with args: ', args);
    const updateResponse = await calendarController.updateEvent(
      args.id,
      args.eventData,
    );
    return updateResponse;
  },

  async deleteEvent(args: { id: string }) {
    console.log('called deleteEvent with args: ', args);
    const deleteResponse = await calendarController.deleteEvent(args.id);
    return deleteResponse;
  },
};

export const executeFunctionCall = async (call: any) => {
  const functionName = call.function.name as FunctionName;

  if (functionName in functionFactory) {
    const args = JSON.parse(call.function.arguments);
    return await functionFactory[functionName](args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};

export const submitToolOutputs = async (
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
