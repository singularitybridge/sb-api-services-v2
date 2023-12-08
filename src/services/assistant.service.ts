import OpenAI, { BadRequestError, NotFoundError } from "openai";
import {
  commandHandlers,
  executeCommand,
} from "../helpers/assistant/command.helper";
import { submitToolOutputs } from "../helpers/assistant/functionFactory";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



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

export const handleUserInput = async (userInput: string,assistantId: string , threadId: string): Promise<string> => {
  try {
    const trimmedInput = userInput.trim().toLowerCase();

    if (commandHandlers.has(trimmedInput)) {
      return await executeCommand(trimmedInput);
    }

    await openaiClient.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    const newRun = await openaiClient.beta.threads.runs.create(
      threadId,
      {
        assistant_id: assistantId,
        //   instructions: "additional instructions",
      }
    );

    console.log(
      `new run created: ${newRun.id}, for thread: ${threadId}`
    );

    const completedRun = await pollRunStatus(threadId, newRun.id);
    console.log("run completed > " + completedRun.status);

    const messages = await openaiClient.beta.threads.messages.list(
      threadId
    );
    // @ts-ignore
    const response = messages.data[0].content[0].text.value;
    return response;
  } catch (error) {
    return handleError(error as Error);
  }
};
