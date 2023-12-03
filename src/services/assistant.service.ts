import OpenAI, { BadRequestError, NotFoundError } from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = "asst_JP476AOSNs6UBz014j1UoDlO";
let currentThreadId = "thread_1neUJzbv7s0rq13KOl5PxQwF";

export const createNewThread = async (): Promise<string> => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};

export const deleteThread = async (threadId: string): Promise<void> => {
  await openai.beta.threads.del(threadId);
};

export const getMessageHistory = (messages: any[]): string => {
  let formattedMessages = "";

  for (const message of messages) {
    const role = message.role === "user" ? "human" : "ai";
    const content = message.content[0].text.value;
    formattedMessages += `${role}: ${content}\n`;
  }

  return formattedMessages;
};

export const handleUserInput = async (
  userInput: string
): Promise<string> => {
  try {
    if (userInput.trim().toLowerCase() === "clear") {
      await deleteThread(currentThreadId);
      currentThreadId = await createNewThread();
      return `Chat history cleared, new thread id: ${currentThreadId}`;
    }

    if (userInput.trim().toLowerCase() === "debug") {
      const messages = await openai.beta.threads.messages.list(currentThreadId);
      const messageHistory = getMessageHistory(messages.data);
      return `Current thread id: ${currentThreadId}\n\nMessage History:\n${messageHistory}`;
    }
    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userInput,
    });

    const newRun = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: assistantId,
    //   instructions: "help the user to schedule an appointment to the dentist." + instructions,
    });

    console.log(
      `new run created: ${newRun.id}, for thread: ${currentThreadId}`
    );

    while (true) {
      const run = await openai.beta.threads.runs.retrieve(
        currentThreadId,
        newRun.id
      );

      console.log(`check run id:${newRun.id} status: ${run.status}`);

      if (run.status === "completed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // get assistant response
    const messages = await openai.beta.threads.messages.list(currentThreadId);

    // @ts-ignore
    const response = messages.data[0].content[0].text.value;
    return response;
  } catch (error) {
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
  }
};
