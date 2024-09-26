import OpenAI from 'openai';
import { getApiKey } from '../../services/api.key.service';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type OpenAIModel = 'tts-1' | 'tts-1-hd';

export const generateSpeech = async (
  companyId: string,
  text: string,
  voice: OpenAIVoice,
  model: OpenAIModel,
  textLimit: number
): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text.slice(0, textLimit),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    // Here you would typically upload this buffer to a storage service and return the URL
    // For this example, we'll just return a placeholder URL
    return 'https://example.com/audio.mp3';
  } catch (error) {
    console.error('Error in generateSpeech:', error);
    throw error;
  }
};

export const transcribeAudioWhisperFromURL = async (
  companyId: string,
  audioUrl: string,
  language?: string
): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();
    const file = new File([audioBlob], 'audio.mp3', { type: audioBlob.type });

    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
    });

    return response.text;
  } catch (error) {
    console.error('Error in transcribeAudioWhisperFromURL:', error);
    throw error;
  }
};

export const getO1CompletionResponse = async (
  companyId: string,
  userInput: string,
  model: string,
  maxTokens: number
): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userInput }],
    //   max_tokens: maxTokens,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error in getO1CompletionResponse:', error);
    throw error;
  }
};

export const summarizeText = async (
  companyId: string,
  text: string,
  maxLength: number
): Promise<string> => {
  const apiKey = await getApiKey(companyId, 'openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const systemPrompt = `You are a text summarizer. Your task is to summarize the given text to be no longer than ${maxLength} characters while preserving the most important information.`;
  const userInput = `Summarize the following text:\n\n${text}`;

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: maxLength,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error in summarizeText:', error);
    throw error;
  }
};