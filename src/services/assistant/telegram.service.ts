import { getUserById } from '../user.service';
import { sendTelegramMessage as sendTelegramBotMessage } from '../telegram.bot';

export const sendTelegramMessage = async (userId: string, message: string, companyId: string) => {
  console.log(`Attempting to send Telegram message to user ${userId}`);
  const user = await getUserById(userId);
  if (user) {
    const telegramId = user.identifiers.find(i => i.key === 'tg_user_id')?.value;
    if (telegramId) {
      console.log(`Found Telegram ID ${telegramId} for user ${userId}`);
      try {
        await sendTelegramBotMessage(companyId, parseInt(telegramId), message);
        console.log(`Successfully sent Telegram message to user ${userId}`);
      } catch (error) {
        console.error(`Error sending Telegram message to user ${userId}:`, error);
      }
    } else {
      console.log(`No Telegram ID found for user ${userId}`);
    }
  } else {
    console.log(`User ${userId} not found`);
  }
};