import TelegramBot from 'node-telegram-bot-api';
import { handleSessionMessage } from './assistant.service';
import { findUserByIdentifier } from './user.service';
import { getApiKey } from './api.key.service';
import { ChannelType } from '../types/ChannelType';
import { getSessionOrCreate } from './session.service';

const TOKEN = '6805951431:AAFLpe3FhD3ucF0csZw2T-jMAVlMuV816Bc';
const bot = new TelegramBot(TOKEN, { polling: true });

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
      await bot.sendMessage(chatId, onboardingMessage);
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
      bot.sendMessage(chatId, `Thanks for the photo, ${fullName}! Unfortunately, I can't process images yet.`);
    } else if (msg.document) {
      bot.sendMessage(chatId, `I received your document, ${fullName}. Unfortunately, I can't process documents yet.`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    bot.sendMessage(chatId, 'Sorry, there was an error processing your message. Please try again later.');
  }
});

export const startTelegramBot = () => {
  console.log('Telegram bot started');
};

export const getTelegramBot = () => bot;