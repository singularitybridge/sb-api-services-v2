// src/middleware/errorHandler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/errors';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      message: err.message,
      error: err.name
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({
      message: 'An error occurred',
      error: err.message
    });
  }

  res.status(500).json({
    message: 'An unknown error occurred'
  });
};