// src/middleware/errorHandler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // For authentication errors, only log a concise message
  if (err instanceof CustomError && err.statusCode === 401) {
    logger.warn(`Auth failed: ${err.message} | ${req.method} ${req.path}`);
  } else if (err instanceof CustomError && err.statusCode === 403) {
    logger.warn(`Access denied: ${err.message} | ${req.method} ${req.path}`);
  } else if (err instanceof CustomError) {
    // Log other custom errors with more detail but no stack trace
    logger.error(`${err.message} | ${req.method} ${req.path}`);
  } else {
    // For unexpected errors, log full details including stack trace
    logger.error(err.message, {
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  res.status(500).json({
    message: 'An unexpected error occurred. Please try again later.',
  });
};
