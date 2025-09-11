import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { getApiKey } from './api.key.service';

class PromptChangeDescriptionService {
  private model = 'gpt-4o-mini';

  private async getOpenAIClient(companyId: string): Promise<OpenAI | null> {
    try {
      const apiKey = await getApiKey(companyId, 'openai_api_key');
      if (!apiKey) {
        logger.warn(`No OpenAI API key found for company ${companyId}`);
        return null;
      }
      return new OpenAI({ apiKey });
    } catch (error) {
      logger.error('Error getting OpenAI client:', error);
      return null;
    }
  }

  /**
   * Generate a change description by comparing old and new prompts
   */
  async generateChangeDescription(
    companyId: string,
    oldPrompt: string | null,
    newPrompt: string,
    assistantName?: string,
  ): Promise<string> {
    try {
      // Handle initial prompt case
      if (!oldPrompt) {
        return `New agent created, initial prompt${
          assistantName ? ` for ${assistantName}` : ''
        }`;
      }

      // If prompts are identical, note that
      if (oldPrompt === newPrompt) {
        return 'No changes detected - prompt remains the same';
      }

      // Get OpenAI client for this company
      const openai = await this.getOpenAIClient(companyId);
      if (!openai) {
        logger.warn(
          `Using fallback description due to missing OpenAI API key for company ${companyId}`,
        );
        return this.generateFallbackDescription(oldPrompt, newPrompt);
      }

      const systemPrompt = `You are a technical documentation assistant that analyzes changes between AI assistant prompts. 
Your task is to generate a concise, meaningful description of what changed between two versions of a prompt.
Focus on:
1. The main purpose or behavior changes
2. New capabilities or restrictions added/removed
3. Tone, style, or formatting changes
4. Any significant structural changes

Keep your response to 1-2 sentences maximum. Be specific and technical but concise.
Do not use phrases like "The prompt was updated to..." - just describe what changed directly.`;

      const userPrompt = `Analyze the changes between these two AI assistant prompts and provide a concise description of what changed:

OLD PROMPT:
"""
${oldPrompt}
"""

NEW PROMPT:
"""
${newPrompt}
"""

What are the key changes?`;

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      const description = response.choices[0]?.message?.content?.trim();

      if (!description) {
        logger.warn('OpenAI returned empty change description');
        return 'Prompt updated with modifications';
      }

      logger.info(`Generated change description using ${this.model}`);
      return description;
    } catch (error) {
      logger.error('Error generating change description with OpenAI:', error);
      // Fallback to basic change detection
      return this.generateFallbackDescription(oldPrompt || '', newPrompt);
    }
  }

  /**
   * Generate a basic fallback description if AI generation fails
   */
  private generateFallbackDescription(
    oldPrompt: string,
    newPrompt: string,
  ): string {
    const oldLines = oldPrompt.split('\n').length;
    const newLines = newPrompt.split('\n').length;
    const oldLength = oldPrompt.length;
    const newLength = newPrompt.length;

    const changes: string[] = [];

    if (newLength > oldLength * 1.2) {
      changes.push('significantly expanded');
    } else if (newLength < oldLength * 0.8) {
      changes.push('significantly reduced');
    } else if (newLength > oldLength) {
      changes.push('expanded');
    } else if (newLength < oldLength) {
      changes.push('reduced');
    }

    if (Math.abs(newLines - oldLines) > 5) {
      changes.push('restructured');
    }

    // Check for common keywords that might indicate changes
    const oldLower = oldPrompt.toLowerCase();
    const newLower = newPrompt.toLowerCase();

    const keywords = [
      'must',
      'should',
      'never',
      'always',
      'important',
      'note',
      'warning',
    ];
    const oldKeywordCount = keywords.reduce(
      (count, keyword) =>
        count + (oldLower.match(new RegExp(keyword, 'g')) || []).length,
      0,
    );
    const newKeywordCount = keywords.reduce(
      (count, keyword) =>
        count + (newLower.match(new RegExp(keyword, 'g')) || []).length,
      0,
    );

    if (newKeywordCount > oldKeywordCount) {
      changes.push('with additional constraints');
    } else if (newKeywordCount < oldKeywordCount) {
      changes.push('with fewer constraints');
    }

    if (changes.length === 0) {
      return 'Prompt updated with modifications';
    }

    return `Prompt ${changes.join(' and ')}`;
  }

  /**
   * Generate a summary of multiple changes
   */
  async generateBatchChangeSummary(
    companyId: string,
    changes: Array<{
      version: number;
      description: string;
      timestamp: Date;
    }>,
  ): Promise<string> {
    try {
      if (changes.length === 0) {
        return 'No changes recorded';
      }

      if (changes.length === 1) {
        return changes[0].description;
      }

      const openai = await this.getOpenAIClient(companyId);
      if (!openai) {
        return `${changes.length} prompt updates applied`;
      }

      const changesText = changes
        .map(
          (c) =>
            `Version ${c.version} (${c.timestamp.toISOString()}): ${
              c.description
            }`,
        )
        .join('\n');

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Summarize these AI prompt changes into a single concise statement (max 2 sentences):',
          },
          {
            role: 'user',
            content: changesText,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      return (
        response.choices[0]?.message?.content?.trim() ||
        'Multiple prompt updates applied'
      );
    } catch (error) {
      logger.error('Error generating batch change summary:', error);
      return `${changes.length} prompt updates applied`;
    }
  }

  /**
   * Analyze prompt for potential issues or improvements
   */
  async analyzePromptQuality(
    companyId: string,
    prompt: string,
  ): Promise<{
    score: number;
    suggestions: string[];
    warnings: string[];
  }> {
    try {
      const openai = await this.getOpenAIClient(companyId);
      if (!openai) {
        return {
          score: 0,
          suggestions: [],
          warnings: [
            'Unable to analyze prompt quality - OpenAI API key not configured',
          ],
        };
      }
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `Analyze this AI assistant prompt for quality and potential issues.
Return a JSON object with:
- score: 1-10 quality score
- suggestions: array of improvement suggestions (max 3)
- warnings: array of potential issues (max 3)`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      );

      return {
        score: analysis.score || 5,
        suggestions: analysis.suggestions || [],
        warnings: analysis.warnings || [],
      };
    } catch (error) {
      logger.error('Error analyzing prompt quality:', error);
      return {
        score: 0,
        suggestions: [],
        warnings: ['Unable to analyze prompt quality'],
      };
    }
  }
}

export const promptChangeDescriptionService =
  new PromptChangeDescriptionService();
export default promptChangeDescriptionService;
