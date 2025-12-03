/**
 * Nylas Integration Entry Point
 *
 * Exports routes, models, and services for the Nylas integration
 * This allows the main application to import from a single location:
 * import { oauthRouter, webhookRouter } from './integrations/nylas';
 */

// Export routes for registration in main index.ts
export { default as oauthRouter } from './routes/nylas-oauth.routes';
export { default as webhookRouter } from './routes/nylas-webhook.routes';

// Export models for external use
export { NylasAccount } from './models/NylasAccount';
export type { INylasAccount } from './models/NylasAccount';
export { EmailProfile } from './models/EmailProfile';
export { NylasWebhook } from './models/NylasWebhook';
export type { INylasWebhook } from './models/NylasWebhook';
export { NylasEventCache } from './models/NylasEventCache';
export { TeamMember } from './models/TeamMember';
export { AdminActionLog } from './models/AdminActionLog';
export type { IAdminActionLog } from './models/AdminActionLog';

// Export contact models
export { ContactMetadata } from './contacts/models/ContactMetadata';
export { ContactDeletionLog } from './contacts/models/ContactDeletionLog';
export { ContactGroup } from './contacts/models/ContactGroup';

// Export services (if needed externally)
export * from './services/nylas-oauth.service';
export * from './services/company-calendar.service';
export * from './services/nylas-grant-resolution.service';

// Export types
export type { NylasEventMultiUser, CreateEventParams } from './nylas-multi-user.service';
