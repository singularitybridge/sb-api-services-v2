import Pusher from 'pusher';

const pusher = new Pusher({
  appId: '1624583',
  key: '7e8897731876adb4652f',
  secret: 'f4becb3e048e4652c519',
  cluster: 'eu',
  useTLS: true,
});

export const publishMessage = async (channel: string = 'sb', eventName: string, message: {}) => {
  pusher.trigger(channel, eventName , {
    message: message,
  });
};
