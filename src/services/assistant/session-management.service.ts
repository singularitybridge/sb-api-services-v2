import { Session } from '../../models/Session';
import { Message, IMessage } from '../../models/Message'; // Import Message model and IMessage interface
import { processTemplate } from '../template.service';
import mongoose from 'mongoose';

// Helper function to transform MongoDB message to OpenAI-like format
const transformMessageToOpenAIFormat = (mongoMessage: IMessage) => {
  let textualContent = mongoMessage.content;

  // Provide a fallback textual content for system messages if original content is empty or undefined
  if (
    mongoMessage.sender === 'system' &&
    (textualContent === undefined || textualContent.trim() === '')
  ) {
    textualContent = `System: ${mongoMessage.messageType || 'Event'}`;
    // If data exists, and it's an object, stringify it to make it part of the textual content for system messages,
    // or handle it in a more structured way if the UI expects raw data for system messages.
    // For now, let's assume the UI primarily uses the 'data' field directly for such messages.
  } else if (textualContent === undefined) {
    textualContent = ''; // Default to empty string if content is undefined for non-system messages
  }

  // Ensure content is always an array of objects with type and text properties
  const contentArray = [{ type: 'text', text: { value: textualContent } }];

  return {
    id: mongoMessage._id.toString(), // Always use MongoDB _id
    role: mongoMessage.sender, // Preserve original sender role (user, assistant, system)
    content: contentArray,
    created_at: Math.floor(mongoMessage.timestamp.getTime() / 1000), // Unix timestamp
    assistant_id: mongoMessage.assistantId?.toString(),
    thread_id: mongoMessage.sessionId?.toString(), // Assuming sessionId can represent thread_id contextually
    message_type: mongoMessage.messageType, // Pass through messageType
    data: mongoMessage.data, // Pass through data field
  };
};

export async function getSessionMessages(apiKey: string, sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Fetch messages from MongoDB
  const mongoMessages = await Message.find({
    sessionId: new mongoose.Types.ObjectId(sessionId),
  })
    .sort({ timestamp: -1 }) // Sort by timestamp descending (newest first)
    .limit(20) // Limit to 20 messages to match OpenAI default
    .lean(); // Use .lean() for better performance as we are transforming the data

  console.log(
    `Retrieved ${mongoMessages.length} messages for session ${sessionId}`,
  );

  if (!mongoMessages || mongoMessages.length === 0) {
    return [];
  }

  const formattedMessages = await Promise.all(
    mongoMessages.map(async (msg) => {
      const openAIFormattedMessage = transformMessageToOpenAIFormat(
        msg as IMessage,
      );

      // Apply template processing for assistant messages
      if (
        openAIFormattedMessage.role === 'assistant' &&
        openAIFormattedMessage.content
      ) {
        const processedContent = await Promise.all(
          openAIFormattedMessage.content.map(async (contentItem: any) => {
            if (contentItem.type === 'text' && contentItem.text) {
              contentItem.text.value = await processTemplate(
                contentItem.text.value,
                sessionId,
              );
            }
            return contentItem;
          }),
        );
        openAIFormattedMessage.content = processedContent;
      }
      return openAIFormattedMessage;
    }),
  );

  return formattedMessages;
}
