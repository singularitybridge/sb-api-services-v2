import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import stream from "stream";
import { promisify } from "util";

export const generateAudio = async (text: string) => {
  console.log("generateAudio ...", text);

  const voiceId = "gbTBNCAEwTTleGFPK23L";

  const data = {
    model_id: "eleven_turbo_v2",
    // model_id: "eleven_multilingual_v2",
    text: text,
    voice_settings: {
      similarity_boost: 0.5,
      stability: 0.5,
      style: 1,
      use_speaker_boost: true,
    },
  };

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      data,
      {
        headers: {
          "xi-api-key": "55a34e51010dc1f6ab29485805ef67eb",
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "stream", // Ensure you get the data as a stream
      }
    );

    const uniqueFileName = `file_${uuidv4()}.mp3`;
    const dir = "./files";
    const filePath = `${dir}/${uniqueFileName}`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const writable = fs.createWriteStream(filePath);
    response.data.pipe(writable);

    await new Promise((resolve, reject) => {
      writable.on("finish", resolve);
      writable.on("error", reject);
    });

    return uniqueFileName;
  } catch (error) {
    console.error(error);
  }
};
