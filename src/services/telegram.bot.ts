import TelegramBot from 'node-telegram-bot-api';
import { getAssistants, handleSessionMessage } from './assistant.service';
import { findUserByIdentifierAndCompany } from './user.service';
import { getApiKey } from './api.key.service';
import { ChannelType } from '../types/ChannelType';
import {
  getSessionOrCreate,
  endSession,
  updateSessionAssistant,
} from './session.service';
import { getCompanies } from './company.service';
import { ICompany, IApiKey } from '../models/Company';
import { IAssistant } from '../models/Assistant';
import { logger } from '../utils/logger';

const bots: Map<string, TelegramBot> = new Map();

// Utility function to normalize company ID
const normalizeCompanyId = (id: string | any): string => {
  if (typeof id === 'string') {
    return id;
  } else if (id && typeof id.toString === 'function') {
    return id.toString();
  }
  logger.error('Invalid company ID type:', { type: typeof id, companyId: id });
  return '';
};

const showMenu = async (bot: TelegramBot, chatId: number) => {
  const menuOptions = {
    reply_markup: {
      keyboard: [
        [{ text: 'Clear Chat' }],
        [{ text: 'Change Agent' }],
        [{ text: 'Help' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  await bot.sendMessage(chatId, 'Here are the available options:', menuOptions);
};

const validateBotToken = async (token: string): Promise<boolean> => {
  try {
    const bot = new TelegramBot(token, { polling: false });
    const me = await bot.getMe();
    return !!me.id;
  } catch (error: any) {
    logger.warn('Invalid Telegram bot token', { error: error.message });
    return false;
  }
};

export const initializeTelegramBots = async () => {
  try {
    logger.info(
      'Telegram integration is currently disabled. Skipping bot initialization.',
    );
    return; // Early exit to disable Telegram bot initialization

    /*
    // const companies = await getCompanies(null); // Temporarily disabled

    // for (const company of companies) { // Temporarily disabled
      // try { // Temporarily disabled
        // const companyId = normalizeCompanyId(company._id); // Temporarily disabled
        const telegramBotToken = await getApiKey(companyId, 'telegram_bot_api_key');

        if (!telegramBotToken) {
          logger.warn(`No Telegram bot token for company ${companyId}`);
          continue;
        }

        const isValidToken = await validateBotToken(telegramBotToken);
        if (!isValidToken) {
          logger.warn(`Invalid Telegram bot token for company ${companyId}`);
          continue;
        }

        const bot = new TelegramBot(telegramBotToken, { polling: false }); // Changed polling to false
        bot.on('polling_error', (error: any) => {
          // Polling is disabled, but we'll keep the error handler in case it's enabled elsewhere or for other error types.
          logger.warn(`Telegram polling error: ${companyId}`, { error: error.message });
        });

        bots.set(companyId, bot);
        logger.info(`✓ Telegram bot started: ${companyId}`);

        bot.onText(/\/start/, async (msg) => {
          const chatId = msg.chat.id;
          await bot.sendMessage(chatId, 'Welcome! Type /menu to see available options.');
        });

        bot.onText(/\/(menu|debug)/, async (msg) => {
          const chatId = msg.chat.id;
          await showMenu(bot, chatId);
        });

        bot.on('message', async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id;
          const username = msg.from?.username || 'Unknown';
          const firstName = msg.from?.first_name || '';
          const lastName = msg.from?.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || username;
          const messageText = msg.text;

          if (!userId) {
            logger.warn('User ID not found in message', { chatId });
            return;
          }

          if (messageText === 'Clear Chat') {
            await handleClearChat(bot, chatId, userId, companyId);
            return;
          }

          if (messageText === 'Change Agent') {
            await handleChangeAgent(bot, chatId, userId, companyId);
            return;
          }

          if (messageText === 'Help') {
            await bot.sendMessage(chatId, 'Here are the available commands:\n/menu - Show menu options\n/debug - Show debug options\nClear Chat - End the current session and start a new one\nChange Agent - Change the currently active assistant');
            return;
          }

          try {
            const companyId = Array.from(bots.entries()).find(([_, b]) => b === bot)?.[0];
            
            if (!companyId) {
              logger.warn('Company not found for Telegram bot', { chatId });
              return;
            }

            const user = await findUserByIdentifierAndCompany('tg_user_id', userId.toString(), companyId);
            
            if (!user) {
              logger.info(`New Telegram user: ${userId}`);
              const onboardingMessage = `Welcome to the Agent Hub! It looks like you haven't connected your Telegram account with the AI Agent Portal yet. To onboard, please use the following number: ${userId}`;
              await bot.sendMessage(chatId, onboardingMessage);
              return;
            }

            logger.debug(`Processing message from user ${user.id}`);

            if (messageText) {
              const apiKey = await getApiKey(companyId, 'openai_api_key') as string;
              
              const session = await getSessionOrCreate(
                apiKey,
                user.id,
                companyId,
                ChannelType.TELEGRAM
              );

              logger.debug(`Session ${session._id} for user ${user.id}`);

              // Updated call to handleSessionMessage, apiKey is no longer needed as first argument
              // and session._id needs to be a string.
              await handleSessionMessage(messageText, session._id.toString(), ChannelType.TELEGRAM);
            } else if (msg.photo) {
              logger.debug(`Photo received from user ${user.id}`);
              bot.sendMessage(chatId, `Thanks for the photo, ${fullName}! Unfortunately, I can't process images yet.`);
            } else if (msg.document) {
              logger.debug(`Document received from user ${user.id}`);
              bot.sendMessage(chatId, `I received your document, ${fullName}. Unfortunately, I can't process documents yet.`);
            }
          } catch (error: any) {
            logger.error(`Message processing failed: ${error.message}`);
            bot.sendMessage(chatId, 'Sorry, there was an error processing your message. Please try again later.');
          }
        });

        logger.info(`✓ Bot ready for company ${companyId}`);
      } catch (error: any) {
        // logger.error(`Bot init failed for ${company._id}: ${error.message}`); // Temporarily disabled
      // } // Temporarily disabled
    // } // Temporarily disabled
    */
  } catch (error: any) {
    logger.error(`Telegram bots initialization failed: ${error.message}`);
  }
};

const handleClearChat = async (
  bot: TelegramBot,
  chatId: number,
  userId: number,
  companyId: string,
) => {
  try {
    const user = await findUserByIdentifierAndCompany(
      'tg_user_id',
      userId.toString(),
      companyId,
    );

    if (!user) {
      logger.warn('User not found for Telegram bot', { companyId, userId });
      await bot.sendMessage(chatId, 'Error clearing chat. Please try again.');
      return;
    }

    const apiKey = (await getApiKey(companyId, 'openai_api_key')) as string;

    const session = await getSessionOrCreate(
      apiKey,
      user.id,
      companyId,
      ChannelType.TELEGRAM,
    );

    await endSession(apiKey, session._id.toString());

    await bot.sendMessage(
      chatId,
      'Your current session has been ended. A new session will start with your next message.',
    );

    // Create a new session immediately
    await getSessionOrCreate(apiKey, user.id, companyId, ChannelType.TELEGRAM);
  } catch (error: any) {
    logger.error('Error clearing chat', {
      companyId,
      userId,
      error: error.message,
    });
    await bot.sendMessage(chatId, 'Error clearing chat. Please try again.');
  }
};

const handleChangeAgent = async (
  bot: TelegramBot,
  chatId: number,
  userId: number,
  companyId: string,
) => {
  try {
    const user = await findUserByIdentifierAndCompany(
      'tg_user_id',
      userId.toString(),
      companyId,
    );

    if (!user) {
      logger.warn('User not found for Telegram bot', { companyId, userId });
      await bot.sendMessage(chatId, 'Error changing agent. Please try again.');
      return;
    }

    const apiKey = (await getApiKey(companyId, 'openai_api_key')) as string;

    const session = await getSessionOrCreate(
      apiKey,
      user.id,
      companyId,
      ChannelType.TELEGRAM,
    );

    // Fetch the list of assistants using the getAssistants function
    const assistants = await getAssistants(companyId);

    if (!assistants || assistants.length === 0) {
      await bot.sendMessage(
        chatId,
        'No assistants available for this company.',
      );
      return;
    }

    // Create inline keyboard buttons for each assistant
    const keyboard = assistants.map((assistant) => [
      {
        text: assistant.name || 'Unnamed Assistant',
        callback_data: `change_assistant:${assistant._id}`,
      },
    ]);

    const inlineKeyboardMarkup: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: keyboard,
    };

    await bot.sendMessage(chatId, 'Please choose an assistant:', {
      reply_markup: inlineKeyboardMarkup,
    });

    // Handle button clicks
    bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.data?.startsWith('change_assistant:')) return;

      const assistantId = callbackQuery.data.split(':')[1];
      const selectedAssistant = assistants.find(
        (a) => a._id.toString() === assistantId,
      );

      if (!selectedAssistant) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Invalid assistant selection.',
        });
        return;
      }

      try {
        await updateSessionAssistant(
          session._id.toString(),
          selectedAssistant._id.toString(),
          companyId,
        );
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Assistant changed to ${selectedAssistant.name}`,
        });
        await bot.sendMessage(
          chatId,
          `You are now chatting with ${selectedAssistant.name}. How can I assist you?`,
        );
      } catch (error: any) {
        logger.error('Error updating assistant', {
          companyId,
          userId,
          assistantId,
          error: error.message,
        });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Error changing agent. Please try again.',
        });
      }
    });
  } catch (error: any) {
    logger.error('Error changing agent', {
      companyId,
      userId,
      error: error.message,
    });
    await bot.sendMessage(chatId, 'Error changing agent. Please try again.');
  }
};

export const getTelegramBot = (companyId: string): TelegramBot | undefined => {
  const normalizedId = normalizeCompanyId(companyId);
  logger.debug('Attempting to get Telegram bot for company', {
    normalizedId,
    originalCompanyId: companyId,
  });
  logger.debug('Current bots in map:', { keys: Array.from(bots.keys()) });
  return bots.get(normalizedId);
};

export const sendTelegramMessage = async (
  companyId: string | any,
  chatId: number,
  message: string,
): Promise<void> => {
  const normalizedId = normalizeCompanyId(companyId);
  logger.debug('Attempting to send Telegram message for company to chat', {
    normalizedId,
    originalCompanyId: companyId,
    chatId,
  });
  const bot = bots.get(normalizedId);
  if (!bot) {
    logger.warn('Telegram bot not found for company ID', {
      normalizedId,
      availableBots: Array.from(bots.keys()),
    });
    throw new Error(`Telegram bot not found for company ID: ${normalizedId}`);
  }
  logger.info('Sending message to chat', { companyId: normalizedId, chatId });
  await bot.sendMessage(chatId, message);
};
