// google api key AIzaSyCmCIWBPBwiYiwHa0KoiL892ucEhRy8hZ8
// output by twilio speech recognition : And Okay, why don't tell me a bit more about how it's going well was in the lounge? Well, it was, you know, a big on and stuff like that. They can make a decision. Thank.

import axios from "axios";
import FormData from "form-data";
import speech from "@google-cloud/speech";

export const transcribeAudio = async (audioURL: string) => {
  try {
    const audioResponse = await axios({
      method: "get",
      url: audioURL,
      responseType: "arraybuffer",
    });

    const formData = new FormData();
    formData.append("file", Buffer.from(audioResponse.data), {
      filename: "audio.mp3",
    });
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const result = await axios({
      method: "post",
      url: "https://api.openai.com/v1/audio/transcriptions",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Replace with your API key
        ...formData.getHeaders(),
      },
      data: formData,
    });

    return result.data.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
  }
};

export const transcribeAudioGoogle = async (audioURL: string) => {
  try {
    const client = new speech.SpeechClient();

    const audioResponse = await axios({
      method: "get",
      url: audioURL,
      responseType: "arraybuffer",
    });

    const audioBytes = audioResponse.data.toString("base64");

    const audio = {
      content: audioBytes,
    };

    const request = {
      audio: audio,
      config: {
        encoding: "LINEAR16" as const,
        sampleRateHertz: 8000,
        languageCode: "en-US",
        useEnhanced: true, // Use enhanced model if available
      },
    };

    const [response] = await client.recognize(request);

    // extract the transcription
    const transcription =
      response.results
        ?.map(
          (result) => result.alternatives?.[0]?.transcript ?? "Unknown segment"
        )
        .join("\n") ?? "No transcription available";

    return transcription;
  } catch (error) {
    console.error(`Error transcribing audio with Google: ${error}`);
    throw error;
  }
};
