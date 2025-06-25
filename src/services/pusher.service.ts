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
  message: Record<string, unknown>
): Promise<void> => {
  // console.log(`[Pusher] Sending message to channel: ${channel}, event: ${eventName}`);
  await pusher.trigger(channel, eventName, message);
  // console.log(`[Pusher] Message sent successfully to channel: ${channel}`);
};

export const publishSessionMessage = async (
  sessionId: string,
  eventName: string,
  message: Record<string, unknown>
): Promise<void> => {
  const channel = `sb-${sessionId}`;
  // console.log(`[Pusher] Publishing session message for sessionId: ${sessionId}, channel: ${channel}, event: ${eventName}`);
  await publishMessage(channel, eventName, message);  
};
