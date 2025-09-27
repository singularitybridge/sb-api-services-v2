import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: process.env.PUSHER_USE_TLS === 'true',
});

export const publishMessage = async (
  channel: string = 'sb',
  eventName: string,
  message: Record<string, unknown>,
): Promise<void> => {
  try {
    // Check message size before sending
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 10240) {
      throw new Error(
        `Message size (${messageSize} bytes) exceeds Pusher limit of 10240 bytes`,
      );
    }

    // console.log(`[Pusher] Sending message to channel: ${channel}, event: ${eventName}`);
    await pusher.trigger(channel, eventName, message);
    // console.log(`[Pusher] Message sent successfully to channel: ${channel}`);
  } catch (error: any) {
    // Log the error but don't throw it to prevent app crashes
    console.error('[Pusher] Error publishing message:', {
      error: error?.message || error,
      status: error?.status,
      channel,
      eventName,
      messageSize: JSON.stringify(message).length,
    });

    // Re-throw only if it's not a Pusher-specific error
    // This prevents unhandled promise rejections while still surfacing other issues
    if (error?.name !== 'PusherRequestError' && error?.status !== 413) {
      throw error;
    }
  }
};

export const publishSessionMessage = async (
  sessionId: string,
  eventName: string,
  message: Record<string, unknown>,
): Promise<void> => {
  const channel = `sb-${sessionId}`;
  // console.log(`[Pusher] Publishing session message for sessionId: ${sessionId}, channel: ${channel}, event: ${eventName}`);
  await publishMessage(channel, eventName, message);
};
