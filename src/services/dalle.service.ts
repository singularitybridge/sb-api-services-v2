import OpenAI from 'openai';
import { getApiKey } from './api.key.service';
import { getSystemAgentService } from './system-agent.service';
import { logger } from '../utils/logger';

/**
 * DALL-E Service
 * Handles image generation using OpenAI DALL-E 3 with system agent prompts
 */

export interface DalleGenerationOptions {
  teamName: string;
  teamPurpose: string;
  styleIndex?: number; // 0-8 for different style variations
  companyId: string;
}

export interface DalleGenerationResult {
  imageUrl: string;
  revisedPrompt?: string;
  styleIndex: number;
}

/**
 * Generate a single team avatar using DALL-E 3
 */
export const generateTeamAvatar = async (
  options: DalleGenerationOptions,
): Promise<DalleGenerationResult> => {
  const { teamName, teamPurpose, styleIndex = 0, companyId } = options;

  // Get company's OpenAI API key
  const apiKey = await getApiKey(companyId, 'openai_api_key');
  if (!apiKey || apiKey === 'default_openai_key') {
    throw new Error(
      'OpenAI API key is not configured for this company. Please add your OpenAI API key in company settings.',
    );
  }

  // Get system agent service and generate prompt
  const agentService = getSystemAgentService();
  const prompt = agentService.generatePrompt('sys-team-avatar-generator', {
    teamName,
    teamPurpose,
    styleIndex,
  });

  logger.info(
    `Generating team avatar for "${teamName}" with style ${styleIndex}`,
  );

  // Initialize OpenAI client with company's API key
  const openai = new OpenAI({ apiKey });

  // Get agent config for DALL-E settings
  const agent = agentService.getAgent('sys-team-avatar-generator');
  if (!agent) {
    throw new Error('Team avatar generator agent not found');
  }

  try {
    // Call DALL-E 3 API
    const response = await openai.images.generate({
      model: agent.config.config.model,
      prompt: prompt,
      n: agent.config.config.n,
      size: agent.config.config.size as '1024x1024',
      quality: agent.config.config.quality as 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    logger.info(`Successfully generated avatar: ${imageUrl.substring(0, 50)}...`);

    return {
      imageUrl,
      revisedPrompt,
      styleIndex,
    };
  } catch (error: any) {
    logger.error('DALL-E generation failed:', error);
    throw new Error(
      `Failed to generate team avatar: ${error.message || 'Unknown error'}`,
    );
  }
};

/**
 * Generate multiple team avatar variations (9 by default)
 */
export const generateTeamAvatarVariations = async (
  options: Omit<DalleGenerationOptions, 'styleIndex'>,
  count: number = 9,
): Promise<DalleGenerationResult[]> => {
  const results: DalleGenerationResult[] = [];

  logger.info(
    `Generating ${count} avatar variations for team "${options.teamName}"`,
  );

  // Generate avatars sequentially to avoid rate limiting
  for (let i = 0; i < count; i++) {
    try {
      const result = await generateTeamAvatar({
        ...options,
        styleIndex: i,
      });
      results.push(result);
    } catch (error: any) {
      logger.error(`Failed to generate variation ${i}:`, error);
      // Continue generating other variations even if one fails
      results.push({
        imageUrl: '',
        revisedPrompt: undefined,
        styleIndex: i,
      });
    }
  }

  const successCount = results.filter((r) => r.imageUrl).length;
  logger.info(
    `Generated ${successCount}/${count} avatar variations successfully`,
  );

  return results;
};

export default {
  generateTeamAvatar,
  generateTeamAvatarVariations,
};
