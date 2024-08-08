import OpenAI from "openai";

export const summarizeText = async (
  apiKey: string,
  text: string,
  maxLength: number
): Promise<string> => {
  const systemPrompt = `You are a text summarizer. Your task is to summarize the given text to be no longer than ${maxLength} characters while preserving the most important information.`;
  const userInput = `Summarize the following text:\n\n${text}`;

  return getCompletionResponse(apiKey, systemPrompt, userInput, "gpt-4", 0.7, maxLength);
};

export const getCompletionResponse = async (
  apiKey: string,
  systemPrompt: string,
  userInput: string,
  model: string = "gpt-4o",
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<string> => {
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userInput
        }
      ],
      temperature,
      max_tokens: maxTokens,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error in getCompletionResponse:", error);
    throw error;
  }
};
