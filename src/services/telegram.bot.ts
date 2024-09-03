import TelegramBot from 'node-telegram-bot-api';
import { getAssistants, handleSessionMessage } from './assistant.service';
import { findUserByIdentifierAndCompany } from './user.service';
import { getApiKey } from './api.key.service';
import { ChannelType } from '../types/ChannelType';
import { getSessionOrCreate, endSession, updateSessionAssistant } from './session.service';
import { getCompanies } from './company.service';
import { ICompany, IApiKey } from '../models/Company';
import { IAssistant } from '../models/Assistant';

const bots: Map<string, TelegramBot> = new Map();

// Utility function to normalize company ID
const normalizeCompanyId = (id: string | any): string => {
  if (typeof id === 'string') {
    return id;
  } else if (id && typeof id.toString === 'function') {
    return id.toString();
  }
  console.error('Invalid company ID type:', typeof id);
  return '';
};

const showMenu = async (bot: TelegramBot, chatId: number) => {
  const menuOptions = {
    reply_markup: {
      keyboard: [
        [{ text: 'Clear Chat' }],
        [{ text: 'Change Agent' }],
        [{ text: 'Help' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  await bot.sendMessage(chatId, 'Here are the available options:', menuOptions);
};

const validateBotToken = async (token: string): Promise<boolean> => {
  try {
    const bot = new TelegramBot(token, { polling: false });
    const me = await bot.getMe();
    return !!me.id;
  } catch (error) {
    console.error('Error validating bot token:', error);
    return false;
  }
};

export const initializeTelegramBots = async () => {
  try {
    const companies = await getCompanies(null);

    for (const company of companies) {
      try {
        const companyId = normalizeCompanyId(company._id);
        const telegramBotToken = await getApiKey(companyId, 'telegram_bot');

        if (!telegramBotToken) {
          console.log(`No Telegram bot token found for company ${companyId}`);
          continue;
        }

        const isValidToken = await validateBotToken(telegramBotToken);
        if (!isValidToken) {
          console.error(`Invalid Telegram bot token for company ${companyId}`);
          continue;
        }

        const bot = new TelegramBot(telegramBotToken, { polling: true });
        bot.on('polling_error', (error) => {
          console.error(`Polling error for company ${companyId}:`, error);
        });

        bots.set(companyId, bot);
        console.log(`Bot added to map for company ${companyId} (type: ${typeof companyId})`);

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
            console.error('User ID not found in message');
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
              console.error(`Company not found for Telegram bot`);
              return;
            }

            const user = await findUserByIdentifierAndCompany('tg_user_id', userId.toString(), companyId);
            
            if (!user) {
              console.log(`[Company ${companyId}] New user detected. Sending onboarding message.`);
              const onboardingMessage = `Welcome to the Agent Hub! It looks like you haven't connected your Telegram account with the AI Agent Portal yet. To onboard, please use the following number: ${userId}`;
              await bot.sendMessage(chatId, onboardingMessage);
              return;
            }

            console.log(`[Company ${companyId}] Processing message for user ${user.id}`);

            if (messageText) {
              const apiKey = await getApiKey(companyId, 'openai') as string;
              
              const session = await getSessionOrCreate(
                apiKey,
                user.id,
                companyId,
                ChannelType.TELEGRAM
              );

              console.log(`[Company ${companyId}] Created/Retrieved session ${session._id} for user ${user.id}`);

              await handleSessionMessage(apiKey, messageText, session._id, ChannelType.TELEGRAM);
            } else if (msg.photo) {
              console.log(`[Company ${companyId}] Received photo from user ${user.id}`);
              bot.sendMessage(chatId, `Thanks for the photo, ${fullName}! Unfortunately, I can't process images yet.`);
            } else if (msg.document) {
              console.log(`[Company ${companyId}] Received document from user ${user.id}`);
              bot.sendMessage(chatId, `I received your document, ${fullName}. Unfortunately, I can't process documents yet.`);
            }
          } catch (error) {
            console.error(`Error processing message:`, error);
            bot.sendMessage(chatId, 'Sorry, there was an error processing your message. Please try again later.');
          }
        });

        console.log(`Telegram bot started for company ${companyId}`);
      } catch (error) {
        console.error(`[DEBUG] Error initializing bot for company ${company._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error initializing Telegram bots:', error);
  }
};

const handleClearChat = async (bot: TelegramBot, chatId: number, userId: number, companyId: string) => {
  try {
    const user = await findUserByIdentifierAndCompany('tg_user_id', userId.toString(), companyId);
    
    if (!user) {
      console.error(`User not found for Telegram bot`);
      await bot.sendMessage(chatId, 'Error clearing chat. Please try again.');
      return;
    }

    const apiKey = await getApiKey(companyId, 'openai') as string;
    
    const session = await getSessionOrCreate(
      apiKey,
      user.id,
      companyId,
      ChannelType.TELEGRAM
    );

    await endSession(apiKey, session._id.toString());

    await bot.sendMessage(chatId, 'Your current session has been ended. A new session will start with your next message.');

    // Create a new session immediately
    await getSessionOrCreate(
      apiKey,
      user.id,
      companyId,
      ChannelType.TELEGRAM
    );
  } catch (error) {
    console.error(`Error clearing chat:`, error);
    await bot.sendMessage(chatId, 'Error clearing chat. Please try again.');
  }
};

const handleChangeAgent = async (bot: TelegramBot, chatId: number, userId: number, companyId: string) => {
  try {
    const user = await findUserByIdentifierAndCompany('tg_user_id', userId.toString(), companyId);
    
    if (!user) {
      console.error(`User not found for Telegram bot`);
      await bot.sendMessage(chatId, 'Error changing agent. Please try again.');
      return;
    }

    const apiKey = await getApiKey(companyId, 'openai') as string;
    
    const session = await getSessionOrCreate(
      apiKey,
      user.id,
      companyId,
      ChannelType.TELEGRAM
    );

    // Fetch the list of assistants using the getAssistants function
    const assistants = await getAssistants(companyId);

    if (!assistants || assistants.length === 0) {
      await bot.sendMessage(chatId, 'No assistants available for this company.');
      return;
    }

    // Create inline keyboard buttons for each assistant
    const keyboard = assistants.map((assistant) => [{
      text: assistant.name || 'Unnamed Assistant',
      callback_data: `change_assistant:${assistant._id}`
    }]);

    const inlineKeyboardMarkup: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: keyboard
    };

    await bot.sendMessage(chatId, 'Please choose an assistant:', { reply_markup: inlineKeyboardMarkup });

    // Handle button clicks
    bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.data?.startsWith('change_assistant:')) return;

      const assistantId = callbackQuery.data.split(':')[1];
      const selectedAssistant = assistants.find((a) => a._id.toString() === assistantId);

      if (!selectedAssistant) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Invalid assistant selection.' });
        return;
      }

      try {
        await updateSessionAssistant(session._id.toString(), selectedAssistant._id.toString(), companyId);
        await bot.answerCallbackQuery(callbackQuery.id, { text: `Assistant changed to ${selectedAssistant.name}` });
        await bot.sendMessage(chatId, `You are now chatting with ${selectedAssistant.name}. How can I assist you?`);
      } catch (error) {
        console.error('Error updating assistant:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error changing agent. Please try again.' });
      }
    });
  } catch (error) {
    console.error(`Error changing agent:`, error);
    await bot.sendMessage(chatId, 'Error changing agent. Please try again.');
  }
};

export const getTelegramBot = (companyId: string): TelegramBot | undefined => {
  const normalizedId = normalizeCompanyId(companyId);
  console.log(`Attempting to get Telegram bot for company ID: ${normalizedId} (original: ${companyId})`);
  console.log('Current bots in map:', Array.from(bots.keys()));
  return bots.get(normalizedId);
};

export const sendTelegramMessage = async (companyId: string | any, chatId: number, message: string): Promise<void> => {
  const normalizedId = normalizeCompanyId(companyId);
  console.log(`Attempting to send Telegram message for company ${normalizedId} (original: ${companyId}) to chat ${chatId}`);
  const bot = bots.get(normalizedId);
  if (!bot) {
    console.error(`Telegram bot not found for company ID: ${normalizedId}`);
    console.log('Available bots:', Array.from(bots.keys()));
    throw new Error(`Telegram bot not found for company ID: ${normalizedId}`);
  }
  console.log(`[Company ${normalizedId}] Sending message to chat ${chatId}`);
  await bot.sendMessage(chatId, message);
};