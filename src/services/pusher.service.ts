import Pusher from 'pusher';

let pusher: Pusher | null = null;

const getPusher = (): Pusher => {
  if (!pusher) {
    // Check if required environment variables are present
    if (
      !process.env.PUSHER_APP_ID ||
      !process.env.PUSHER_KEY ||
      !process.env.PUSHER_SECRET ||
      !process.env.PUSHER_CLUSTER
    ) {
      console.warn(
        '[Pusher] Missing required environment variables. Pusher will not be initialized.',
      );
      throw new Error(
        'Pusher configuration is missing. Please check your environment variables.',
      );
    }

    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: process.env.PUSHER_USE_TLS === 'true',
    });

    console.log(
      '[Pusher] Initialized successfully with cluster:',
      process.env.PUSHER_CLUSTER,
    );
  }
  return pusher;
};

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

    // Get or initialize Pusher instance
    const pusherInstance = getPusher();

    // console.log(`[Pusher] Sending message to channel: ${channel}, event: ${eventName}`);
    await pusherInstance.trigger(channel, eventName, message);
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

    // Log non-critical message if it's a configuration issue
    if (error?.message?.includes('Pusher configuration is missing')) {
      console.error('Pusher publishing failed (non-critical):', error);
      return; // Don't re-throw configuration errors
    }

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
