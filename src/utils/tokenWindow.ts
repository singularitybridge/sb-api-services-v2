import { CoreMessage, ImagePart, TextPart } from 'ai';
import { encode } from 'gpt-tokenizer';

// Estimated token counts for images based on OpenAI's documentation
// https://platform.openai.com/docs/guides/vision/calculating-costs
const LOW_DETAIL_IMAGE_TOKENS = 85;
const HIGH_DETAIL_IMAGE_TOKENS_PER_TILE = 170; // For 512x512 tiles
const BASE_HIGH_DETAIL_TOKENS = 85;

// Function to estimate tokens for an image part
// This is a simplified estimation. Actual token count can vary.
function estimateImageTokens(imagePart: ImagePart): number {
  // Assuming 'auto' or not specified defaults to a high-detail equivalent for safety margin,
  // or if 'detail' property is not standard in Vercel AI SDK's ImagePart for all providers.
  // If a 'detail' property were available and set to 'low', we'd use LOW_DETAIL_IMAGE_TOKENS.
  // For now, let's use a higher estimate as a placeholder.
  // A more sophisticated approach might involve checking image dimensions if available.
  // For simplicity here, we'll use a fixed estimate.
  // Let's assume a general estimate, e.g., similar to a couple of high-detail tiles.
  // This is a placeholder and should be refined based on typical image sizes or provider specifics.
  return BASE_HIGH_DETAIL_TOKENS + (2 * HIGH_DETAIL_IMAGE_TOKENS_PER_TILE); // Example: 2 tiles
}

export function trimToWindow(
  messages: CoreMessage[],
  maxTokens: number
): { trimmedMessages: CoreMessage[]; tokensInPrompt: number } {
  const reversed: CoreMessage[] = [...messages].reverse();
  let totalTokens = 0;
  const kept: CoreMessage[] = [];

  for (const m of reversed) {
    let messageTokens = 0;
    if (typeof m.content === 'string') {
      messageTokens = encode(m.content).length;
    } else if (Array.isArray(m.content)) {
      // Handle array content (multimodal)
      for (const part of m.content) {
        if (part.type === 'text') {
          messageTokens += encode((part as TextPart).text).length;
        } else if (part.type === 'image') {
          messageTokens += estimateImageTokens(part as ImagePart);
        }
      }
    }
    // Add a small buffer for message metadata (role, etc.)
    const cost = messageTokens + 4; 

    if (totalTokens + cost > maxTokens) {
      // If adding the current message exceeds maxTokens, and it's the *only* message considered so far,
      // and it's a user message with multiple parts (likely text + image),
      // try to keep at least the text part if it fits. This is a basic heuristic.
      if (kept.length === 0 && m.role === 'user' && Array.isArray(m.content) && m.content.length > 1) {
        let textPartTokens = 0;
        const textPartsContent: TextPart[] = [];
        (m.content as Array<TextPart | ImagePart>).forEach(part => {
          if (part.type === 'text') {
            textPartTokens += encode(part.text).length;
            textPartsContent.push(part);
          }
        });

        if (textPartTokens + 4 <= maxTokens) {
          // If only text parts fit, keep them
          const partialMessage: CoreMessage = { ...m, content: textPartsContent };
          totalTokens += textPartTokens + 4;
          kept.push(partialMessage);
        }
        // Whether it fit or not, we break because the full message didn't.
        break; 
      }
      break; // Stop if adding this message exceeds the limit
    }
    totalTokens += cost;
    kept.push(m);
  }
  
  // If no messages were kept (e.g., the very first message was too large),
  // and the original messages array was not empty, this indicates an issue.
  // The calling code should handle this (e.g., by erroring or sending a truncated message).
  // For now, trimToWindow will return an empty array as per its logic.
  if (kept.length === 0 && messages.length > 0) {
    console.warn(`trimToWindow: No messages kept. First message might be too large. Max tokens: ${maxTokens}, First message cost estimate: (see logs above if any)`);
  }

  return { trimmedMessages: kept.reverse(), tokensInPrompt: totalTokens };
}
