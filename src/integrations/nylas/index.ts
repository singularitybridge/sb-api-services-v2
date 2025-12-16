/**
 * Nylas Integration - Entry Point
 *
 * Exports router and services for the Nylas integration.
 * This is the first fully self-contained integration with routes + models + services.
 */

// Export route registration function (self-registering pattern)
export { registerNylasRoutes } from './register';

// Export router for explicit mounting in index.ts (direct use)
export { default as nylasRouter } from './routes';

// Export actions for integration framework
export * from './nylas.actions';

// Export services for direct use (facade)
export * from './nylas.service';

// Export types
export * from './types';

// Export models
export { NylasGrant } from './models/NylasGrant';
