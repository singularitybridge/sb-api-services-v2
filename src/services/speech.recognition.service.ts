//file_path:src/services/speech.recognition.service.ts
import axios from 'axios';
import FormData from 'form-data';
import speech from '@google-cloud/speech';

export const transcribeAudioWhisper = async (
  apiKey: string,
  audioBuffer: Buffer,
  language: string = 'en',
) => {
  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const result = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      data: formData,
    });

    return result.data.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};

export const transcribeAudioWhisperFromURL = async (
  apiKey: string,
  audioURL: string,
  language: string = 'en',
) => {
  try {
    const audioResponse = await axios({
      method: 'get',
      url: audioURL,
      responseType: 'arraybuffer',
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    return await transcribeAudioWhisper(apiKey, audioBuffer, language);
  } catch (error) {
    console.error('Error transcribing audio from URL:', error);
    throw error;
  }
};

export const transcribeAudioGoogle = async (
  audioURL: string,
  language: string = 'en-US',
) => {
  try {
    const client = new speech.SpeechClient();

    const audioResponse = await axios({
      method: 'get',
      url: audioURL,
      responseType: 'arraybuffer',
    });

    const audioBytes = audioResponse.data.toString('base64');

    const audio = {
      content: audioBytes,
    };

    const request = {
      audio: audio,
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 8000,
        languageCode: language,
        useEnhanced: true, // Use enhanced model if available
      },
    };

    const [response] = await client.recognize(request);

    // extract the transcription
    const transcription =
      response.results
        ?.map(
          (result) => result.alternatives?.[0]?.transcript ?? 'Unknown segment',
        )
        .join('\n') ?? 'No transcription available';

    return transcription;
  } catch (error) {
    console.error(`Error transcribing audio with Google: ${error}`);
    throw error;
  }
};
