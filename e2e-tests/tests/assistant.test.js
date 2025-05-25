import fs from 'fs';
import yaml from 'js-yaml';
// import fetch from 'node-fetch';        // node ≥18? remove this import
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const cases = yaml.load(fs.readFileSync('e2e-tests/tests/tests.yaml', 'utf8')); // Corrected path
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY); // Corrected variable name

async function callAgent(prompt) {
  const res = await fetch(process.env.ENDPOINT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SESSION_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream' // Ensure SSE is requested
    },
    body: JSON.stringify({ userInput: prompt, sessionId: '682ce6511b783b9533c541cc' })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullResponse = ''; // To assemble the full reply
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value);

    // Process buffer for SSE messages
    let eolIndex;
    while ((eolIndex = buf.indexOf('\\n\\n')) >= 0) {
      const message = buf.slice(0, eolIndex);
      buf = buf.slice(eolIndex + 2); // Skip \n\n
      if (message.startsWith('data:')) {
        try {
          const jsonData = JSON.parse(message.substring(5)); // Skip 'data:'
          if (jsonData.type === 'token' && jsonData.value) {
            fullResponse += jsonData.value;
          } else if (jsonData.type === 'done') {
            // Optional: handle 'done' message if needed
          } else if (jsonData.type === 'error') {
            console.error('Stream error:', jsonData.errorDetails);
            throw new Error(jsonData.errorDetails.message || 'Unknown stream error');
          }
        } catch (e) {
          console.error('Error parsing SSE JSON:', e, 'Raw message:', message);
        }
      }
    }
  }
  return fullResponse; // Return the assembled reply
}

function judgePrompt(userPrompt, assistantReply, rule) {
  return (
    `You are a strict QA judge.\n\n` +
    `User prompt:\n${userPrompt}\n\n` +
    `Assistant reply:\n${assistantReply}\n\n` +
    `Requirement:\n${rule}\n\n` +
    `Answer only YES or NO, then short reason.`
  );
}

describe('AI-assistant happy-path tests', () => {
  for (const tc of cases) {
    test(tc.name, async () => {
      const reply = await callAgent(tc.prompt);

      // simple string checks
      (tc.mustContain || []).forEach(s =>
        expect(reply).toEqual(expect.stringContaining(s))
      );
      (tc.mustNotContain || []).forEach(s =>
        expect(reply).not.toEqual(expect.stringContaining(s))
      );

      // LLM evaluation
      if (tc.expectedBehavior) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Corrected model initialization
        const result = await model.generateContent(judgePrompt(tc.prompt, reply, tc.expectedBehavior));
        const response = await result.response; // Get the response object
        const text = response.text(); // Get the text from the response
        const verdict = text.trim().toLowerCase().startsWith('yes');
        expect(verdict).toBe(true);
      }
    }, 30_000);            // 30 s timeout per test
  }
});
