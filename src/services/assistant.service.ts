import OpenAI, { BadRequestError, NotFoundError } from "openai";
import {
  commandHandlers,
  executeCommand,
} from "../helpers/assistant/command.helper";
import { logging } from "googleapis/build/src/apis/logging";
import { CalendarController } from "../controllers/calendar.controller";
import { IEventRequest } from "../Interfaces/eventRequest.interface";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const assistantId = "asst_JP476AOSNs6UBz014j1UoDlO";
export let currentThreadId = "thread_EJANzkCSrwA2NC1VPmp5cRK0";

export const setCurrentThreadId = (id: string) => {
  currentThreadId = id;
};

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

  async createEvent(args: IEventRequest) {
    console.log("called createEvent with args: ", args);
    const eventCreationResponse = await calendarController.createEvent(args);
    return eventCreationResponse;
  },

  async updateEvent(args: { id: string; eventData: IEventRequest }) {
    console.log("called updateEvent with args: ", args);
    const updateResponse = await calendarController.updateEvent(args.id,args.eventData);
    return updateResponse;
  },

  async deleteEvent(args: { id: string }) {
    console.log("called deleteEvent with args: ", args);
    const deleteResponse = await calendarController.deleteEvent(args.id);
    return deleteResponse;
  },



};

const executeFunctionCall = async (call: any) => {
  const functionName = call.function.name as FunctionName;

  if (functionName in functionFactory) {
    const args = JSON.parse(call.function.arguments);
    return await functionFactory[functionName](args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};

const submitToolOutputs = async (
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

const handleError = (error: Error): string => {
  let response = "Something went wrong, ";

  if (error instanceof NotFoundError) {
    response += "Thread not found:" + error.message;
  } else if (error instanceof BadRequestError) {
    response += "Bad request: " + error.message;
    console.log("bad request");
  } else {
    throw error;
  }

  return response;
};

const pollRunStatus = async (
  threadId: string,
  runId: string,
  timeout: number = 35000
) => {
  const startTime = Date.now();
  let lastRun;

  while (Date.now() - startTime < timeout) {
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`check run id:${runId} status: ${run.status}`);
    lastRun = run;

    const completedStatuses = ["completed", "cancelled", "failed", "expired"];
    if (completedStatuses.includes(run.status)) {
      return run;
    }

    if (
      run.status === "requires_action" &&
      run.required_action?.type === "submit_tool_outputs"
    ) {
      await submitToolOutputs(
        threadId,
        runId,
        run.required_action.submit_tool_outputs.tool_calls
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, timeout - (Date.now() - startTime)))
    );
  }

  throw new Error("Timeout exceeded while waiting for run to complete");
};

export const handleUserInput = async (userInput: string): Promise<string> => {
  try {
    const trimmedInput = userInput.trim().toLowerCase();

    if (commandHandlers.has(trimmedInput)) {
      return await executeCommand(trimmedInput);
    }

    await openaiClient.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userInput,
    });

    const newRun = await openaiClient.beta.threads.runs.create(
      currentThreadId,
      {
        assistant_id: assistantId,
        //   instructions: "additional instructions",
      }
    );

    console.log(
      `new run created: ${newRun.id}, for thread: ${currentThreadId}`
    );

    const completedRun = await pollRunStatus(currentThreadId, newRun.id);
    console.log("run completed > " + completedRun.status);

    const messages = await openaiClient.beta.threads.messages.list(
      currentThreadId
    );
    // @ts-ignore
    const response = messages.data[0].content[0].text.value;
    return response;
  } catch (error) {
    return handleError(error as Error);
  }
};
