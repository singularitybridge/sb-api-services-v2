/**
 * Nylas Service - Backward Compatibility Facade
 *
 * This file now serves as a facade that re-exports all functions from modular services.
 * This ensures backward compatibility while we gradually update imports across the codebase.
 *
 * Original implementation has been split into:
 * - services/email.service.ts - Email operations
 * - services/calendar.service.ts - Calendar CRUD
 * - services/contacts.service.ts - Contact management
 * - services/grants.service.ts - Grant lifecycle
 * - services/invitations.service.ts - OAuth invitations
 * - services/availability.service.ts - Scheduling intelligence
 * - services/batch.service.ts - Batch operations
 */

// Re-export all types
export * from './types';

// Re-export all services
export * from './services';

// Named exports for convenience (commonly used functions)
export {
  // Email
  getEmails,
  getEmailById,
  sendEmail,
} from './services/email.service';

export {
  // Calendar
  getCalendars,
  getCalendarEvents,
  createCalendarEvent,
  getEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './services/calendar.service';

export {
  // Contacts
  getContacts,
  createContact,
  updateContact,
} from './services/contacts.service';

export {
  // Grants
  GrantsService,
} from './services/grants.service';

export {
  // Invitations
  InvitationService,
} from './services/invitations.service';

export {
  // Availability
  getFreeBusy,
  findAvailableSlots,
  checkEventConflicts,
} from './services/availability.service';

export {
  // Batch
  createMultipleEvents,
} from './services/batch.service';
