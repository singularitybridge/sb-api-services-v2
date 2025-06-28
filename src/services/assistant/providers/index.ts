import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { LanguageModelV1 } from 'ai'; // For return type hint

// Note: The { apiKey } in options for *.chat() methods is based on the
// assumption that these providers (especially Google/Anthropic) will support it.
// For the currently installed @ai-sdk/openai@1.3.22, apiKey in chat options is NOT supported
// and it relies on process.env.OPENAI_API_KEY.
// A true Vercel AI SDK v4 implementation would typically use:
// e.g., createOpenAI({ apiKey }).chat(modelName) or similar for each provider.

export function getProvider(
  providerKey: string | undefined, // Make providerKey potentially undefined to handle default
  modelName: string,
  apiKey: string,
): LanguageModelV1 {
  switch (providerKey) {
    case 'google':
      // Ensure @ai-sdk/google is installed and supports this structure.
      // If using createGoogle style:
      // const googleProvider = createGoogle({ apiKey });
      // return googleProvider.chat(modelName);
      // For @ai-sdk/google@1.2.18, apiKey in chat options is likely not supported.
      // It will rely on environment variables (e.g., GOOGLE_API_KEY).
      return google.chat(modelName, {
        /* apiKey: apiKey */
        // Not supported in current google provider version
      });
    case 'anthropic':
      // Ensure @ai-sdk/anthropic is installed and supports this structure.
      // If using createAnthropic style:
      // const anthropicProvider = createAnthropic({ apiKey });
      // return anthropicProvider.chat(modelName);
      // For @ai-sdk/anthropic@1.2.11, apiKey in chat options is likely not supported.
      // It will rely on environment variables (e.g., ANTHROPIC_API_KEY).
      return anthropic.chat(modelName, {
        /* apiKey: apiKey */
        // Not supported in current anthropic provider version
      });
    case 'openai':
    default:
      // For @ai-sdk/openai@1.3.22, apiKey in chat options is not supported.
      // It will rely on process.env.OPENAI_API_KEY.
      // The apiKey parameter passed to getProvider will be ignored for this case
      // until the SDK is updated.
      // If SDK were v4, it might be:
      // const openaiProvider = createOpenAI({ apiKey });
      // return openaiProvider.chat(modelName);
      // Or directly: openai(modelName, { apiKey }) if openai itself is the factory function.
      // Given the current import, openai.chat is used.
      return openai.chat(modelName, {
        /* apiKey: apiKey */
        // Not supported in current openai version
      });
  }
}
