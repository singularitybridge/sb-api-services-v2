// src/utils/actionErrors.ts

/**
 * Base class for custom errors related to action execution.
 */
export class BaseActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // This is to ensure that instanceof works correctly after transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when an action fails during its execution phase,
 * typically after parameters have been validated.
 */
export class ActionExecutionError extends BaseActionError {
  public readonly actionName?: string;
  public readonly originalError?: any;
  public readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      actionName?: string;
      originalError?: any;
      statusCode?: number;
    }
  ) {
    super(message);
    this.actionName = options?.actionName;
    this.originalError = options?.originalError;
    this.statusCode = options?.statusCode || 500;
  }
}

/**
 * Error thrown when action parameters fail validation.
 */
export class ActionValidationError extends BaseActionError {
  public readonly fieldErrors?: Record<string, string>;
  public readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      fieldErrors?: Record<string, string>;
      statusCode?: number;
    }
  ) {
    super(message);
    this.fieldErrors = options?.fieldErrors;
    this.statusCode = options?.statusCode || 400; // Bad Request
  }
}

/**
 * Error thrown when a service called by an action returns an unsuccessful response
 * that is not already an exception.
 */
export class ActionServiceError extends BaseActionError {
  public readonly serviceName?: string;
  public readonly serviceResponse?: any;
  public readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      serviceName?: string;
      serviceResponse?: any;
      statusCode?: number;
    }
  ) {
    super(message);
    this.serviceName = options?.serviceName;
    this.serviceResponse = options?.serviceResponse;
    this.statusCode = options?.statusCode || 500;
  }
}
