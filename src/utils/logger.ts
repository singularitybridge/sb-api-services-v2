import winston from 'winston';
import 'winston-daily-rotate-file';
import dotenv from 'dotenv';

dotenv.config();

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const nodeEnv = process.env.NODE_ENV || 'development';
if (!process.env.NODE_ENV) {
  console.warn(
    "NODE_ENV environment variable not set. Defaulting to 'development'.",
  );
}

let logLevel = process.env.LOG_LEVEL;
if (!logLevel) {
  console.warn("LOG_LEVEL environment variable not set. Defaulting to 'info'.");
  logLevel = 'info';
}

let logFormat = process.env.LOG_FORMAT;
if (!logFormat) {
  const defaultFormat = nodeEnv === 'production' ? 'json' : 'simple';
  console.warn(
    `LOG_FORMAT environment variable not set. Defaulting to '${defaultFormat}'.`,
  );
  logFormat = defaultFormat;
}

const enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
if (process.env.ENABLE_FILE_LOGGING === undefined && nodeEnv === 'production') {
  // console.warn("ENABLE_FILE_LOGGING environment variable not set. File logging is disabled by default in production. Set to 'true' to enable.");
  // No warning for this one as it's a common default to not log to files unless specified.
}

// Define colors for different log levels
const levelColors = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m', // yellow
  info: '\x1b[36m', // cyan
  debug: '\x1b[35m', // magenta
};

const resetColor = '\x1b[0m';

const customFormat = printf(
  ({ level, message, timestamp: ts, ...metadata }) => {
    // Simplify the format - no service name
    let msg = `${ts} ${level}: ${message}`;

    // Handle metadata more cleanly
    if (metadata && Object.keys(metadata).length > 0) {
      // Filter out internal Winston properties
      const filteredMetadata = Object.entries(metadata).reduce(
        (acc, [key, value]) => {
          if (
            key !== 'level' &&
            key !== 'message' &&
            key !== 'timestamp' &&
            key !== 'service' &&
            key !== 'splat' &&
            key !== 'stack'
          ) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      if (Object.keys(filteredMetadata).length > 0) {
        // Format metadata more readably
        if (
          Object.keys(filteredMetadata).length === 1 &&
          filteredMetadata.error
        ) {
          // Special handling for error messages
          msg += ` | ${filteredMetadata.error}`;
        } else if (Object.keys(filteredMetadata).length <= 3) {
          // For small metadata, show inline
          const metaParts = Object.entries(filteredMetadata).map(
            ([k, v]) =>
              `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`,
          );
          msg += ` | ${metaParts.join(', ')}`;
        } else {
          // For larger metadata, show on new line
          msg +=
            '\n  ' +
            JSON.stringify(filteredMetadata, null, 2).split('\n').join('\n  ');
        }
      }
    }

    // Add stack trace for errors if available
    if (metadata.stack && nodeEnv !== 'production') {
      msg += `\n  Stack: ${metadata.stack}`;
    }

    return msg;
  },
);

// Simpler format for production
const simpleFormat = printf(({ level, message, timestamp: ts }) => {
  return `${ts} ${level}: ${message}`;
});

const transports: winston.transport[] = [];

if (nodeEnv !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize({
          all: true,
          colors: {
            info: 'cyan',
            warn: 'yellow',
            error: 'red',
            debug: 'magenta',
          },
        }),
        timestamp({ format: 'HH:mm:ss' }), // Shorter timestamp for dev
        errors({ stack: true }),
        customFormat,
      ),
    }),
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json(), // JSON format for production
      ),
    }),
  );
  // Optional: File logging for production
  if (enableFileLogging) {
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: combine(timestamp(), errors({ stack: true }), json()),
      }),
    );
  }
}

const winstonLogger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
  ),
  transports: transports,
});

// Extend Winston logger with backward compatibility methods
class ExtendedLogger {
  private logs: string[] = [];

  // Winston logger methods
  log = (level: string, message: string, meta?: any) => {
    this.logs.push(`${level}: ${message}`);
    return winstonLogger.log(level, message, meta);
  };

  info = (message: string, meta?: any) => {
    this.logs.push(`info: ${message}`);
    return winstonLogger.info(message, meta);
  };

  warn = (message: string, meta?: any) => {
    this.logs.push(`warn: ${message}`);
    return winstonLogger.warn(message, meta);
  };

  error = (message: string, meta?: any) => {
    this.logs.push(`error: ${message}`);
    return winstonLogger.error(message, meta);
  };

  debug = (message: string, meta?: any) => {
    this.logs.push(`debug: ${message}`);
    return winstonLogger.debug(message, meta);
  };

  // Backward compatibility methods
  getLogs() {
    return this.logs.join('\n');
  }

  clearLogs() {
    this.logs = [];
  }
}

const logger = new ExtendedLogger();

// Add a stream for morgan or other http loggers if needed
// logger.stream = {
//   write: (message) => {
//     logger.info(message.trim());
//   },
// };

export { logger };
