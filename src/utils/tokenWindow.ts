import { CoreMessage } from 'ai';
import { encode } from 'gpt-tokenizer';

export function trimToWindow(
  messages: CoreMessage[],
  maxTokens: number // Made maxTokens a required parameter
): { trimmedMessages: CoreMessage[]; tokensInPrompt: number } {
  const reversed: CoreMessage[] = [...messages].reverse();
  let totalTokens = 0;
  const kept: CoreMessage[] = [];

  for (const m of reversed) {
    const cost = encode(
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).length + 4; // reserve few tokens / msg metadata
    if (totalTokens + cost > maxTokens) break;
    totalTokens += cost;
    kept.push(m);
  }
  return { trimmedMessages: kept.reverse(), tokensInPrompt: totalTokens };
}
