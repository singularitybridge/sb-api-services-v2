// src/middleware/errorHandler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/errors';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Check for AI_APICallError specifically
  // We can check for a unique property or a symbol if available.
  // Based on the log, err.statusCode and err.responseBody are good indicators.
  // Also, the error name might be 'APICallError' or 'AI_APICallError'.
  // Let's assume it has a 'statusCode' and 'responseBody' if it's an APICallError.
  if (typeof err === 'object' && err !== null && 'statusCode' in err && 'responseBody' in err && 'message' in err) {
    // Attempt to parse responseBody if it's a JSON string
    let errorDetails = err.responseBody;
    try {
      if (typeof err.responseBody === 'string') {
        errorDetails = JSON.parse(err.responseBody);
      }
    } catch (parseError) {
      // If parsing fails, use the raw responseBody
    }
    
    return res.status(err.statusCode as number).json({
      message: (err as { message: string }).message, // Main error message
      error: (err as { name?: string }).name || 'APICallError', // Error name
      details: errorDetails // Detailed response from the API call
    });
  }

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      message: err.message,
      error: err.name
    });
  }

  if (err instanceof Error) {
    // General error handling
    return res.status(500).json({
      message: 'An error occurred',
      error: err.message // Provide the actual error message
    });
  }

  // Fallback for unknown errors
  res.status(500).json({
    message: 'An unknown error occurred'
  });
};
