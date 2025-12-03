# Nylas Integration Patterns & Best Practices

## Overview

This document explains the architectural decisions made to keep the Nylas integration self-contained within `src/integrations/nylas/`, minimizing dependencies on external services and models.

## Core Principle: Self-Contained Integrations

**Goal**: All integration-specific code should reside within the integration folder, with minimal coupling to core application services.

**Benefits**:
- Easier to maintain and update
- Clear separation of concerns
- Simpler to add/remove integrations
- Reduced risk of breaking core services

## Patterns Used in Nylas Integration

### 1. OAuth Token Storage (Replacing User Model Pollution)

#### ❌ Anti-Pattern: Adding Integration Fields to Core Models

```typescript
// DON'T: Pollute User model with integration-specific fields
export interface IUser extends Document {
  name: string;
  email: string;
  companyId: mongoose.Types.ObjectId;
  authTokens?: { token: string; createdAt: Date }[]; // ❌ Nylas-specific
}
```

**Problem**: This couples the core User model to a specific integration.

#### ✅ Best Practice: Integration-Specific Models

```typescript
// DO: Create integration-specific model
// Location: src/integrations/nylas/models/NylasOAuthToken.ts

export interface INylasOAuthToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

// Automatic cleanup with TTL index
NylasOAuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**Benefits**:
- User model remains clean
- Integration can be removed without touching core models
- Token management logic stays in integration folder
- Automatic cleanup via MongoDB TTL indexes

**Usage Example**:

```typescript
// Creating OAuth token for callback authentication
import { NylasOAuthToken } from '../models/NylasOAuthToken';
import { nanoid } from 'nanoid';

const token = nanoid(32);
await NylasOAuthToken.create({
  userId: user._id,
  token,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
});

// Using token in OAuth callback
const oauthToken = await NylasOAuthToken.findOne({ token }).lean();
if (oauthToken && oauthToken.expiresAt > new Date()) {
  const user = await User.findById(oauthToken.userId);
  // Authenticate user...
}
```

### 2. Environment-Based Configuration (Replacing API Key Service)

#### ❌ Anti-Pattern: Adding Integration Keys to Shared Service

```typescript
// DON'T: Add integration-specific keys to shared enum
export type ApiKeyType =
  | 'openai_api_key'
  | 'nylas_client_id'      // ❌ Nylas-specific
  | 'nylas_client_secret'  // ❌ Nylas-specific
  | ...
```

**Problem**: Every integration adds to this enum, making it grow indefinitely.

#### ✅ Best Practice: Environment Variables

```typescript
// DO: Use environment variables directly in integration
// Location: src/integrations/nylas/services/nylas-oauth.service.ts

export async function getOAuthConfig(companyId: string): Promise<NylasOAuthConfig> {
  const clientId = process.env.NYLAS_CLIENT_ID;
  const clientSecret = process.env.NYLAS_API_SECRET || process.env.NYLAS_CLIENT_SECRET;
  const redirectUri = process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/nylas/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Nylas OAuth credentials not configured. Set NYLAS_CLIENT_ID and NYLAS_CLIENT_SECRET environment variables.');
  }

  return { clientId, clientSecret, redirectUri };
}
```

**Benefits**:
- No shared service pollution
- Clearer configuration (all in .env file)
- Easier to deploy (standard env vars)
- Integration can be removed without updating ApiKeyService

**Setup Example**:

```bash
# .env file
NYLAS_CLIENT_ID=your_client_id_here
NYLAS_CLIENT_SECRET=your_client_secret_here
NYLAS_REDIRECT_URI=https://api.singularitybridge.net/api/nylas/oauth/callback
```

### 3. Integration-Specific Prompt Augmentation (Replacing Global Middleware)

#### ❌ Anti-Pattern: Adding Integration Logic to Core Message Handling

```typescript
// DON'T: Add integration-specific logic to core services
// Location: src/services/assistant/message-handling.service.ts

// ❌ This couples core service to Nylas integration
if (assistant.allowedActions?.some(action => action.startsWith('nylas.'))) {
  const dateContext = `Current date: ${new Date().toISOString()}...`;
  finalSystemPrompt = systemPrompt + dateContext;
}
```

**Problem**: Core message handling service becomes aware of specific integrations.

#### ✅ Best Practice: Prompt Engineering or Action-Level Context

**Option A: Include Context in Assistant Prompt (Recommended)**

```markdown
## Assistant Prompt Template

You are a calendar assistant with access to Nylas actions.

**IMPORTANT: Current Date and Time**
- Today's date: {{currentDate}}
- Current year: {{currentYear}}
- ALWAYS use {{currentYear}} or later for future events
- Use ISO 8601 format for all dates

## Available Actions
- nylasScheduleMeetingWithTeam
- nylasGetCompanySchedule
...
```

**Option B: Action-Level Context Injection**

```typescript
// Location: src/integrations/nylas/company-orchestrator/company-orchestrator.actions.ts

export const createCompanyOrchestratorActions = (context: ActionContext): FunctionFactory => ({
  nylasScheduleMeetingWithTeam: {
    description:
      'Schedule a meeting with multiple participants. ' +
      `IMPORTANT: Today's date is ${new Date().toISOString().split('T')[0]}. ` +
      'Always use current or future dates when scheduling.',
    // ... rest of action definition
  },
});
```

**Benefits**:
- Core services remain integration-agnostic
- Context is visible in prompts (easier to debug)
- Each integration manages its own context needs
- No runtime conditionals in shared code

### 4. Integration Entry Point

#### ✅ Required Pattern: Single Entry Point

```typescript
// Location: src/integrations/nylas/index.ts

// Export all routes
export { default as oauthRouter } from './routes/nylas-oauth.routes';
export { default as webhookRouter } from './routes/nylas-webhook.routes';

// Export all models
export { NylasAccount } from './models/NylasAccount';
export type { INylasAccount } from './models/NylasAccount';
export { EmailProfile } from './models/EmailProfile';
export type { IEmailProfile } from './models/EmailProfile';
// ... other exports

// Export all actions
export { createCompanyOrchestratorActions } from './company-orchestrator/company-orchestrator.actions';
export { createTeamAvailabilityActions } from './team-orchestration/team-availability.actions';
```

**Usage in Core Application**:

```typescript
// Location: src/index.ts

import {
  oauthRouter as nylasOAuthRouter,
  webhookRouter as nylasWebhookRouter
} from './integrations/nylas';

app.use('/api/nylas/oauth', nylasOAuthRouter);
app.use('/api/nylas/webhook', nylasWebhookRouter);
```

**Benefits**:
- Single import point for all integration functionality
- Clear API surface
- Easy to see what integration exports
- Follows module pattern best practices

## File Structure

```
src/integrations/nylas/
├── index.ts                          # Entry point (exports)
├── models/                           # Integration-specific models
│   ├── NylasAccount.ts
│   ├── NylasOAuthToken.ts           # OAuth token storage
│   ├── EmailProfile.ts
│   └── ...
├── services/                         # Business logic
│   ├── nylas-oauth.service.ts       # Uses env vars directly
│   ├── company-calendar.service.ts
│   └── ...
├── routes/                           # HTTP endpoints
│   ├── nylas-oauth.routes.ts
│   └── nylas-webhook.routes.ts
├── middleware/                       # Integration middleware
│   └── nylas-webhook-validator.ts
├── agents/                           # Agent services
│   ├── calendar-agent.service.ts
│   └── ...
├── company-orchestrator/             # Orchestration layer
│   └── company-orchestrator.actions.ts
├── team-orchestration/               # Team features
│   └── team-availability.actions.ts
├── utils/                            # Helper functions
│   └── date-validation.ts
└── docs/                             # Documentation
    ├── INTEGRATION_PATTERNS.md      # This file
    └── ...
```

## Minimal External Changes

Only **ONE** external change is required:

### Required: Route Registration in Core App

```typescript
// Location: src/index.ts

import {
  oauthRouter as nylasOAuthRouter,
  webhookRouter as nylasWebhookRouter
} from './integrations/nylas';

// Register routes
app.use('/api/nylas/oauth', nylasOAuthRouter);
app.use('/api/nylas/webhook', nylasWebhookRouter);
```

**Why Required**: Express routes must be registered in the main application.

**Pattern**: This is the same for ALL integrations (Linear, SendGrid, etc.).

## Migration Guide: Removing External Dependencies

If you find integration code that touches external files, refactor using these patterns:

### Step 1: Identify the Coupling

```bash
# Check what files your integration touches outside its folder
git diff main | grep "^diff" | grep -v "src/integrations/your-integration"
```

### Step 2: Apply Appropriate Pattern

| External Change | Pattern to Use | Example |
|----------------|---------------|---------|
| Adding model fields | Create integration-specific model | `NylasOAuthToken` instead of `User.authTokens` |
| Adding API key types | Use environment variables | `process.env.NYLAS_CLIENT_ID` |
| Modifying message handling | Prompt engineering or action context | Include context in prompts |
| Adding shared types | Duplicate within integration | Avoid cross-integration imports |

### Step 3: Document the Decision

Add comments explaining why the integration follows this pattern:

```typescript
/**
 * OAuth Token Storage
 *
 * Uses integration-specific model instead of adding fields to User model.
 * This keeps the integration self-contained and prevents core model pollution.
 *
 * See: src/integrations/nylas/docs/INTEGRATION_PATTERNS.md
 */
```

## Testing Integration Isolation

To verify your integration is properly isolated:

```bash
# 1. Check file changes (should only be in integration folder + index.ts)
git diff main --name-only | grep -v "src/integrations/your-integration" | grep -v "src/index.ts"

# 2. Check imports (should not import from core services except types)
grep -r "from '../../../" src/integrations/your-integration/

# 3. Check for model pollution
git diff main src/models/

# 4. Check for shared service pollution
git diff main src/services/
```

## Summary

✅ **DO**:
- Create integration-specific models in `models/`
- Use environment variables for configuration
- Include context in prompts or action descriptions
- Export everything through `index.ts`
- Keep 100% of business logic in integration folder

❌ **DON'T**:
- Add fields to core models (User, Company, etc.)
- Add keys to shared ApiKeyService
- Add integration logic to core services
- Import deeply from core services
- Create cross-integration dependencies

## Questions?

When in doubt, ask:
1. "Can this integration be deleted by removing just the integration folder?"
2. "Would another integration need this same functionality?"
3. "Is this code specific to this integration's business logic?"

If the answer to #1 is "no", refactor using the patterns above.
