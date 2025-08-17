import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param id - The ID to validate
 * @returns true if valid, false otherwise
 */
export const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Express middleware to validate MongoDB ObjectId parameters
 * @param paramName - The name of the parameter to validate (default: 'id')
 */
export const validateObjectId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        error: `Invalid ${paramName} format. Must be a valid 24-character hex string.`,
      });
    }

    next();
  };
};

/**
 * Express middleware to validate multiple MongoDB ObjectId parameters
 * @param paramNames - Array of parameter names to validate
 */
export const validateObjectIds = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName];

      if (!id || !isValidObjectId(id)) {
        return res.status(400).json({
          error: `Invalid ${paramName} format. Must be a valid 24-character hex string.`,
        });
      }
    }

    next();
  };
};
