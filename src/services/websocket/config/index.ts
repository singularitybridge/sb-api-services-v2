export const websocketConfig = {
  path: '/realtime',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
};
