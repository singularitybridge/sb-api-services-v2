import OpenAI from 'openai';
import axios from 'axios';
const pdf = require('pdf-parse');

export const summarizeText = async (
  apiKey: string,
  text: string,
  maxLength: number,
): Promise<string> => {
  const systemPrompt = `You are a text summarizer. Your task is to summarize the given text to be no longer than ${maxLength} characters while preserving the most important information.`;
  const userInput = `Summarize the following text:\n\n${text}`;

  return getCompletionResponse(
    apiKey,
    systemPrompt,
    userInput,
    'gpt-4.1-mini',
    0.7,
  );
};

export const getO1CompletionResponse = async (
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string,
): Promise<string> => {
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error in getO1CompletionResponse:', error);
    throw error;
  }
};

const fetchAndParsePdf = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const data = await pdf(response.data);
    return data.text;
  } catch (error) {
    console.error('Error fetching or parsing PDF:', error);
    throw new Error('Failed to fetch or parse PDF file');
  }
};

export const getCompletionResponse = async (
  apiKey: string,
  systemPrompt: string,
  userInput: string,
  model: string = 'gpt-4.1-mini',
  temperature: number = 0.7,
  pdfUrl?: string,
): Promise<string> => {
  let enhancedUserInput = userInput;

  if (pdfUrl) {
    try {
      const pdfContent = await fetchAndParsePdf(pdfUrl);
      enhancedUserInput = `Context from PDF:\n${pdfContent}\n\nUser Question:\n${userInput}`;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error('Failed to process PDF file');
    }
  }

  const o1Models = ['o1', 'o1-mini', 'o1-preview'];

  if (o1Models.includes(model)) {
    return getO1CompletionResponse(
      apiKey,
      [{ role: 'user', content: `${systemPrompt}\n\n${enhancedUserInput}` }],
      model,
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedUserInput },
    ];

    const params: any = {
      model,
      messages,
      temperature,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    const response = await openai.chat.completions.create(params);

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error in getCompletionResponse:', error);
    throw error;
  }
};
