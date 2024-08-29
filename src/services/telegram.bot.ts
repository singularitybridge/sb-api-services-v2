import TelegramBot from 'node-telegram-bot-api';
import { handleSessionMessage } from './assistant.service';
import { findUserByIdentifier } from './user.service';
import { getApiKey } from './api.key.service';
import { ChannelType } from '../types/ChannelType';
import { getSessionOrCreate } from './session.service';
import { getCompany } from './company.service';

let bot: TelegramBot | null = null;

export const initializeTelegramBot = async (companyId: string) => {
  try {
    const telegramBotToken = await getApiKey(companyId, 'telegram_bot') as string;

    if (!telegramBotToken) {
      console.warn(`TG bot token not found for company ID: ${companyId}`);
      return;
    }

    bot = new TelegramBot(telegramBotToken, { polling: true });

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

      console.log(`Received message from User ID: ${userId}, Username: ${username}, Name: ${fullName}`);

      try {
        const user = await findUserByIdentifier('tg_user_id', userId.toString());
        
        if (!user) {
          // Send onboarding message for new users
          const onboardingMessage = `Welcome to the Agent Hub! It looks like you haven't connected your Telegram account with the AI Agent Portal yet. To onboard, please use the following number: ${userId}`;
          await bot?.sendMessage(chatId, onboardingMessage);
          return; // Exit early as we can't process messages for non-registered users
        }

        if (messageText) {
          const apiKey = await getApiKey(user.companyId.toString(), 'openai') as string;
          
          const session = await getSessionOrCreate(
            apiKey,
            user.id,
            user.companyId.toString(),
            ChannelType.TELEGRAM
          );

          await handleSessionMessage(apiKey, messageText, session._id, ChannelType.TELEGRAM);
          
        } else if (msg.photo) {
          bot?.sendMessage(chatId, `Thanks for the photo, ${fullName}! Unfortunately, I can't process images yet.`);
        } else if (msg.document) {
          bot?.sendMessage(chatId, `I received your document, ${fullName}. Unfortunately, I can't process documents yet.`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        bot?.sendMessage(chatId, 'Sorry, there was an error processing your message. Please try again later.');
      }
    });

    console.log('Telegram bot started');
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
    bot = null;
  }
};

export const getTelegramBot = (): TelegramBot => {
  if (!bot) {
    throw new Error('Telegram bot has not been initialized');
  }
  return bot;
};

export const sendTelegramMessage = async (chatId: number, message: string): Promise<void> => {
  if (!bot) {
    throw new Error('Telegram bot has not been initialized');
  }
  await bot.sendMessage(chatId, message);
};