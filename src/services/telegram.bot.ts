import TelegramBot from 'node-telegram-bot-api';
import { handleSessionMessage } from './assistant.service';
import { findUserByIdentifierAndCompany } from './user.service';
import { getApiKey } from './api.key.service';
import { ChannelType } from '../types/ChannelType';
import { getSessionOrCreate } from './session.service';
import { getCompanies } from './company.service';
import { ICompany, IApiKey } from '../models/Company';

const bots: Map<string, TelegramBot> = new Map();

export const initializeTelegramBots = async () => {
  try {
    const companies = await getCompanies(null);

    for (const company of companies) {
      try {
        const telegramBotToken = await getApiKey(company._id.toString(), 'telegram_bot');

        if (!telegramBotToken) {
          continue;
        }

        const bot = new TelegramBot(telegramBotToken, { polling: true });
        bots.set(company._id.toString(), bot);

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

        console.log(`Telegram bot started for company ${company._id}`);
      } catch (error) {
        console.error(`[DEBUG] Error initializing bot for company ${company._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error initializing Telegram bots:', error);
  }
};

export const getTelegramBot = (companyId: string): TelegramBot => {
  console.log('bots', bots);

  const bot = bots.get(companyId);
  if (!bot) {
    throw new Error(`Telegram bot not found for company ID: ${companyId}`);
  }
  return bot;
};

export const sendTelegramMessage = async (companyId: string, chatId: number, message: string): Promise<void> => {
  const bot = getTelegramBot(companyId);
  console.log(`[Company ${companyId}] Sending message to chat ${chatId}`);
  await bot.sendMessage(chatId, message);
};