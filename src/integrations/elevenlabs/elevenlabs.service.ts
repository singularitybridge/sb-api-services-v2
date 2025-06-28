import axios from 'axios';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ApiKey } from '../../services/verification.service';
import { uploadFile } from '../../services/google.storage.service'; // Added import

interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
}

interface GenerateAudioResult {
  success: boolean;
  data?: {
    audioUrl: string;
  };
  error?: string;
}

interface GenerateSpeechOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  filename?: string;
}

export const generateAudio = async (
  apiKey: string,
  text: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM',
  modelId?: string, // Added modelId here
  filename?: string,
): Promise<GenerateAudioResult> => {
  try {
    const result = await generateSpeech(
      { apiKey },
      { text, voiceId, modelId, filename }, // Pass modelId
    );
    return {
      success: true,
      data: {
        audioUrl: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const generateSpeech = async (
  config: ElevenLabsConfig,
  options: GenerateSpeechOptions,
): Promise<string> => {
  const {
    text,
    voiceId = '21m00Tcm4TlvDq8ikWAM', // Default voice - Rachel
    modelId = 'eleven_multilingual_v2', // Default model updated
  } = options;

  const client = new ElevenLabsClient({ apiKey: config.apiKey });

  try {
    // Changed to use client.textToSpeech.stream() based on common SDK patterns
    // and persistent errors with client.generate()
    const audioStream = await client.textToSpeech.stream(voiceId, {
      text,
      modelId: modelId, // Corrected from model_id to modelId
      voiceSettings: {
        // Corrected from voice_settings to voiceSettings
        stability: 0.5,
        similarityBoost: 0.5, // Corrected from similarity_boost to similarityBoost
      },
    });

    // The SDK returns a ReadableStream, we need to convert it to a buffer then base64
    const chunks = [];
    for await (const chunk of audioStream) {
      // Corrected typo: audio -> audioStream
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    // const audioBase64 = buffer.toString('base64');
    // const audioUrl = `data:audio/mpeg;base64,${audioBase64}`; // We will upload instead

    const fileName = options.filename
      ? `${options.filename}.mp3`
      : `elevenlabs_audio_${Date.now()}.mp3`;

    // Create a partial File object for uploadFile
    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit', // Appropriate for binary data like audio
      mimetype: 'audio/mpeg',
      buffer: buffer,
      size: buffer.length,
    };

    const publicUrl = await uploadFile(file as Express.Multer.File); // Removed second argument

    return publicUrl; // Return the public URL
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ElevenLabs API error: ${error.message}`);
    }
    throw error;
  }
};

export const listModels = async (apiKey: string): Promise<any> => {
  const client = new ElevenLabsClient({ apiKey });
  try {
    const models = await client.models.list();
    return models;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ElevenLabs API error listing models: ${error.message}`);
    }
    throw error;
  }
};

export const listVoices = async (apiKey: string): Promise<any> => {
  const client = new ElevenLabsClient({ apiKey });
  try {
    // The example uses client.voices.search, but the SDK has client.voices.list()
    // and client.voices.getAll() which seems more appropriate for a general list.
    // client.voices.search() is for finding specific voices.
    // The user's example was `await client.voices.search({ includeTotalCount: true });`
    // This implies the search method can take an object with parameters.
    // The error indicated 'include_total_count' was not valid in RequestOptions (the second param of search).
    // It should be part of the first parameter (search parameters).
    // The user's example was `await client.voices.search({ includeTotalCount: true });`
    // This implies a single object argument.
    const searchResult = await client.voices.search({
      // query: '', // Optional: if an empty query string is needed explicitly
      includeTotalCount: true, // Corrected to camelCase as suggested by previous error hint
    });
    return searchResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ElevenLabs API error listing voices: ${error.message}`);
    }
    throw error;
  }
};

export const verifyElevenLabsKey = async (key: ApiKey): Promise<boolean> => {
  if (typeof key !== 'string') {
    return false;
  }
  const client = new ElevenLabsClient({ apiKey: key });
  try {
    await client.voices.getAll(); // Changed from list() to getAll()
    return true;
  } catch (error) {
    return false;
  }
};
