export const websocketConfig = {
  path: '/realtime',
  cors: {
    origin: ((): string | string[] => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS;
      if (allowedOrigins) {
        return allowedOrigins.split(',');
      }
      console.warn("ALLOWED_ORIGINS environment variable not set. Defaulting to '*' for CORS, which might be insecure for production.");
      return '*';
    })(),
    methods: ['GET', 'POST'],
    credentials: true
  }
};
