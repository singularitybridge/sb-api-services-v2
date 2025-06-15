import Pusher from 'pusher';

const pusher = new Pusher({
  appId: '1624583',
  key: '7e8897731876adb4652f',
  secret: 'f4becb3e048e4652c519',
  cluster: 'eu',
  useTLS: true,
});

export const publishMessage = async (
  channel: string = 'sb',
  eventName: string,
  message: Record<string, unknown>
): Promise<void> => {
  console.log(`[Pusher] Sending message to channel: ${channel}, event: ${eventName}`);
  await pusher.trigger(channel, eventName, message);
  // console.log(`[Pusher] Message sent successfully to channel: ${channel}`);
};

export const publishSessionMessage = async (
  sessionId: string,
  eventName: string,
  message: Record<string, unknown>
): Promise<void> => {
  const channel = `sb-${sessionId}`;
  console.log(`[Pusher] Publishing session message for sessionId: ${sessionId}, channel: ${channel}, event: ${eventName}`);
  await publishMessage(channel, eventName, message);  
};
