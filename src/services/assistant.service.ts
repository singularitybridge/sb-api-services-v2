import OpenAI, { BadRequestError, NotFoundError } from "openai";
import {
  createNewThread,
  deleteThread,
  getMessageHistoryFormatted,
} from "./oai.thread.service";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = "asst_JP476AOSNs6UBz014j1UoDlO";
let currentThreadId = "thread_1neUJzbv7s0rq13KOl5PxQwF";

enum Commands {
  Clear = "clear",
  Debug = "debug",
}

const commandHandlers = new Map<string, () => Promise<string>>([
  [
    Commands.Clear,
    async () => {
      await deleteThread(currentThreadId);
      currentThreadId = await createNewThread();
      return `Chat history cleared, new thread id: ${currentThreadId}`;
    },
  ],
  [
    Commands.Debug,
    async () => {
      const messages = await openaiClient.beta.threads.messages.list(
        currentThreadId
      );
      const messageHistory = getMessageHistoryFormatted(messages.data);
      return `Current thread id: ${currentThreadId}\n\nMessage History:\n${messageHistory}`;
    },
  ],
]);

const executeCommand = async (command: string): Promise<string> => {
  const handler = commandHandlers.get(command);
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  return handler();
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
  timeout: number = 10000
) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
    console.log(`check run id:${runId} status: ${run.status}`);
    if (run.status === "completed") {
      return;
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

    await pollRunStatus(currentThreadId, newRun.id);

    // get assistant response
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
