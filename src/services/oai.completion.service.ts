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
  imageUrl?: string,
  imageBase64?: string,
  maxTokens?: number,
): Promise<string> => {
  let enhancedUserInput = userInput;
  let messages: any[] = [];

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

  // Handle image inputs for vision-capable models
  const visionModels = ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  const isVisionCapable =
    visionModels.some((vm) => model.includes(vm)) || model === 'gpt-4o';

  if ((imageUrl || imageBase64) && !isVisionCapable) {
    // Auto-upgrade to vision model if an image is provided
    console.log(`Auto-upgrading from ${model} to gpt-4o for image analysis`);
    model = 'gpt-4o';
  }

  if (o1Models.includes(model)) {
    // O1 models don't support images yet
    if (imageUrl || imageBase64) {
      throw new Error('O1 models do not support image inputs');
    }
    return getO1CompletionResponse(
      apiKey,
      [{ role: 'user', content: `${systemPrompt}\n\n${enhancedUserInput}` }],
      model,
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    // Construct messages based on whether we have an image
    if (imageUrl || imageBase64) {
      // Use multimodal format for vision models
      const imageUrlToUse = imageUrl || `data:image/jpeg;base64,${imageBase64}`;

      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: enhancedUserInput },
            {
              type: 'image_url',
              image_url: {
                url: imageUrlToUse,
                detail: 'high', // Can be 'low', 'high', or 'auto'
              },
            },
          ],
        },
      ];
    } else {
      // Standard text-only format
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedUserInput },
      ];
    }

    const params: any = {
      model,
      messages,
      temperature,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    // Add max_tokens if provided or for vision models
    if (maxTokens) {
      params.max_tokens = maxTokens;
    } else if (imageUrl || imageBase64) {
      params.max_tokens = 4096;
    }

    const response = await openai.chat.completions.create(params);

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error in getCompletionResponse:', error);
    throw error;
  }
};
