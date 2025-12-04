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
export { NylasOAuthToken } from './models/NylasOAuthToken';
export type { INylasOAuthToken } from './models/NylasOAuthToken';

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

/**
 * Integration Registration Function
 *
 * Called by the integration loader to register Nylas routes dynamically.
 * This keeps the main application agnostic to specific integrations.
 *
 * @param app Express application instance
 */
export async function register(app: any): Promise<void> {
  // Dynamically import routes to avoid loading them at module load time
  const { default: oauthRouter } = await import('./routes/nylas-oauth.routes');
  const { default: webhookRouter } = await import('./routes/nylas-webhook.routes');

  // Register OAuth routes
  app.use('/api/nylas/oauth', oauthRouter);
  console.log('[NYLAS] Registered OAuth routes at /api/nylas/oauth');

  // Register webhook routes
  app.use('/webhooks', webhookRouter);
  console.log('[NYLAS] Registered webhook routes at /webhooks');

  // Register Agents API module (if enabled)
  const enableAgentsApi = process.env.ENABLE_AGENTS_API !== 'false';
  if (enableAgentsApi) {
    console.log('[NYLAS] Agents API module enabled, registering...');
    const { registerAgentsApiModule } = await import('./agents-api');
    const { verifyAccess } = await import('../../middleware/auth.middleware');
    await registerAgentsApiModule(app, verifyAccess);
  } else {
    console.log('[NYLAS] Agents API module disabled via ENABLE_AGENTS_API env var');
  }
}
