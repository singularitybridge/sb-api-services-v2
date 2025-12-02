/**
 * Date Validation Utilities for Calendar Operations
 *
 * Provides comprehensive date validation to prevent AI from creating
 * events with incorrect dates (e.g., wrong year, past dates, etc.)
 */

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
  parsedDate?: Date;
}

export interface DateValidationOptions {
  allowPastDates?: boolean;  // Default: false (reject past dates)
  maxMonthsAway?: number;     // Default: 24 (reject dates >2 years away)
  context?: 'start' | 'end' | 'range_start' | 'range_end';
}

/**
 * Validates a single event date
 *
 * @param dateString - Date string in ISO 8601 format or Unix timestamp
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validateEventDate(
  dateString: string | number,
  options: DateValidationOptions = {}
): DateValidationResult {
  const {
    allowPastDates = false,
    maxMonthsAway = 24,
    context = 'start',
  } = options;

  // Get current date from server (not AI)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  // Parse the date
  let parsedDate: Date;
  try {
    if (typeof dateString === 'number') {
      parsedDate = new Date(dateString * 1000); // Unix timestamp
    } else {
      parsedDate = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
      return {
        isValid: false,
        error: `Invalid date format: "${dateString}". Please use ISO 8601 format (e.g., "2025-12-03T13:00:00+02:00").`,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to parse date: "${dateString}". ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  const eventYear = parsedDate.getFullYear();
  const eventMonth = parsedDate.getMonth() + 1;

  // Validation 1: Check if date is in the past
  if (!allowPastDates && parsedDate < now) {
    const timeDiff = now.getTime() - parsedDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    return {
      isValid: false,
      error: `Event ${context} time (${dateString}) is ${daysDiff} day(s) in the past. Current server date: ${now.toISOString()}. Please use a future date.`,
      parsedDate,
    };
  }

  // Validation 2: Check if year is before current year
  if (eventYear < currentYear) {
    return {
      isValid: false,
      error: `Event year ${eventYear} is before current year ${currentYear}. Current date is ${now.toISOString().split('T')[0]}. Did you mean year ${currentYear} or ${currentYear + 1}?`,
      parsedDate,
    };
  }

  // Validation 3: Check if date is too far in the future
  const monthsAway = (parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsAway > maxMonthsAway) {
    return {
      isValid: false,
      error: `Event date is approximately ${Math.floor(monthsAway)} months in the future. Maximum allowed is ${maxMonthsAway} months. Please verify the date is correct.`,
      parsedDate,
    };
  }

  // Validation 4: Detect suspicious date patterns (common AI errors)
  // Example: AI might confuse MM/DD with DD/MM
  if (eventYear === currentYear && eventMonth < currentMonth) {
    const monthsAgo = currentMonth - eventMonth;
    return {
      isValid: false,
      error: `Event date ${eventYear}-${String(eventMonth).padStart(2, '0')} is ${monthsAgo} month(s) ago. Current date: ${now.toISOString().split('T')[0]}. Did you mean month ${String(currentMonth).padStart(2, '0')} or later?`,
      parsedDate,
    };
  }

  // All validations passed
  return {
    isValid: true,
    parsedDate,
  };
}

/**
 * Validates a date range (start and end dates)
 *
 * @param startDate - Start date string
 * @param endDate - End date string
 * @param options - Validation options
 * @returns Validation result
 */
export function validateDateRange(
  startDate: string | number,
  endDate: string | number,
  options: DateValidationOptions = {}
): DateValidationResult {
  // Validate start date
  const startValidation = validateEventDate(startDate, {
    ...options,
    context: 'range_start',
  });

  if (!startValidation.isValid) {
    return startValidation;
  }

  // Validate end date
  const endValidation = validateEventDate(endDate, {
    ...options,
    context: 'range_end',
    allowPastDates: true, // End can be "in past" relative to now if start is valid
  });

  if (!endValidation.isValid) {
    return endValidation;
  }

  // Check that end is after start
  if (endValidation.parsedDate! <= startValidation.parsedDate!) {
    return {
      isValid: false,
      error: `End time (${endDate}) must be after start time (${startDate}). ` +
        `Start: ${startValidation.parsedDate!.toISOString()}, End: ${endValidation.parsedDate!.toISOString()}`,
    };
  }

  // Check duration is reasonable (not more than 7 days)
  const durationMs = endValidation.parsedDate!.getTime() - startValidation.parsedDate!.getTime();
  const durationDays = durationMs / (1000 * 60 * 60 * 24);

  if (durationDays > 7) {
    return {
      isValid: false,
      error: `Event duration is ${durationDays.toFixed(1)} days. Maximum reasonable duration is 7 days. Please verify the dates are correct.`,
    };
  }

  return {
    isValid: true,
    parsedDate: startValidation.parsedDate,
  };
}

/**
 * Format a validation error for display/logging
 */
export function formatValidationError(
  actionName: string,
  dateString: string | number,
  validationResult: DateValidationResult
): string {
  const now = new Date();
  return `[DATE VALIDATION ERROR] ${actionName}
  Requested date: ${dateString}
  ${validationResult.parsedDate ? `Parsed as: ${validationResult.parsedDate.toISOString()}` : 'Failed to parse'}
  Current server time: ${now.toISOString()}
  Error: ${validationResult.error}`;
}

/**
 * Log date validation details (for debugging)
 */
export function logDateValidation(
  actionName: string,
  dateString: string | number,
  validationResult: DateValidationResult
): void {
  const now = new Date();

  if (validationResult.isValid) {
    console.log(`[DATE VALIDATION] ${actionName}
  ✅ VALID
  Requested: ${dateString}
  Parsed: ${validationResult.parsedDate!.toISOString()}
  Current server time: ${now.toISOString()}`);
  } else {
    console.warn(formatValidationError(actionName, dateString, validationResult));
  }
}
