import { openaiClient } from "../../services/assistant.service";
import { createNewThread, deleteThread, getMessageHistoryFormatted } from "../../services/oai.thread.service";

export enum Commands {
  Clear = "clear",
  Debug = "debug",
}

export const commandHandlers = new Map<string, () => Promise<string>>([
  [
    Commands.Clear,
    async () => {
      const currentThreadId = 'test';
      // await deleteThread(currentThreadId);
      // const threadId = await createNewThread();
      // setCurrentThreadId(threadId);
      return `Chat history cleared, new thread id: ${currentThreadId}`;
    },
  ],
  [
    Commands.Debug,
    async () => {
      const currentThreadId = 'test';
      const messageHistory = 'test';
      // const messages = await openaiClient.beta.threads.messages.list(
      //   currentThreadId
      // );
      // const messageHistory = getMessageHistoryFormatted(messages.data);
      return `Current thread id: ${currentThreadId}\n\nMessage History:\n${messageHistory}`;
    },
  ],
]);

export const executeCommand = async (command: string): Promise<string> => {
  const handler = commandHandlers.get(command);
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  return handler();
};
