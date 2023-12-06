import { IEventRequestBody } from "../../Interfaces/eventRequest.interface";
import { CalendarController } from "../../controllers/calendar.controller";
import { openaiClient } from "../../services/assistant.service";

type FunctionName = keyof typeof functionFactory;
const calendarController = new CalendarController();

const functionFactory = {
  async getEvents(args: { start: string; end: string }) {
    console.log("called getEvents with args: ", args);
    const events = await calendarController.getEvents(args.start, args.end);
    return events;
  },

  async getFreeSlots(args: { start: string; end: string; duration: number }) {
    console.log("called getFreeSlots with args: ", args);
    const freeSlots = await calendarController.getFreeSlots(
      args.start,
      args.end,
      args.duration
    );
    return freeSlots;
  },

  async createEvent(args: IEventRequestBody) {
    console.log("called createEvent with args: ", args);
    const eventCreationResponse = await calendarController.createEvent(args);
    return eventCreationResponse;
  },

  async updateEvent(args: { id: string; eventData: IEventRequestBody }) {
    console.log("called updateEvent with args: ", args);
    const updateResponse = await calendarController.updateEvent(
      args.id,
      args.eventData
    );
    return updateResponse;
  },

  async deleteEvent(args: { id: string }) {
    console.log("called deleteEvent with args: ", args);
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
  toolCalls: any[]
) => {
  console.log("called submitToolOutputs with args: ", toolCalls);

  const outputs = await Promise.all(
    toolCalls.map(async (call) => {
      const output = await executeFunctionCall(call);
      return {
        tool_call_id: call.id,
        output: JSON.stringify(output),
      };
    })
  );

  console.log("tool outputs: ", outputs);

  await openaiClient.beta.threads.runs.submitToolOutputs(threadId, runId, {
    tool_outputs: outputs,
  });
};
