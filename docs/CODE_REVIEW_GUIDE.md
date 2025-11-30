# Nylas Integration Code Review Guide

## 📋 Meeting Preparation Checklist

### Before the Meeting (5-10 minutes)
- [ ] Open PR #42 in browser: https://github.com/singularitybridge/sb-api-services-v2/pull/42
- [ ] Have VS Code open with the 3 changed files
- [ ] Start dev server: `npm run dev`
- [ ] Open terminal for live testing
- [ ] Have Postman/Insomnia ready (or use curl)
- [ ] Open this guide in a separate window

### Tools to Share Screen
1. **GitHub PR** - Show the overview and file changes
2. **VS Code** - Walk through code
3. **Terminal** - Demonstrate live testing
4. **Postman/curl** - API testing

---

## 🎯 Meeting Structure (30-45 minutes)

### 1. Introduction (5 minutes)

**Say:**
> "We're reviewing PR #42 which adds Nylas integration for email and calendar management. This adds 14 new actions that AI assistants can use to interact with Nylas API v3. The PR includes 3 files with about 1,286 lines of new code."

**Show GitHub PR:**
- Overview with description
- Files changed tab (3 files)
- No merge conflicts ✅

---

### 2. Architecture Overview (5 minutes)

**Show diagram on whiteboard or screen:**

```
┌─────────────────────────────────────────────────────────┐
│                    AI Assistant                          │
│              (e.g., Calendar Genius)                     │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Calls action: "nylasListEvents"
                    ▼
┌─────────────────────────────────────────────────────────┐
│              Action Discovery Layer                      │
│           (discovery.service.ts)                         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Routes to Nylas integration
                    ▼
┌─────────────────────────────────────────────────────────┐
│            Nylas Integration Layer                       │
│   ┌──────────────────────────────────────────────┐     │
│   │  nylas.actions.ts (14 action definitions)    │     │
│   └──────────────┬───────────────────────────────┘     │
│                  │                                       │
│                  │ Delegates to service layer            │
│                  ▼                                       │
│   ┌──────────────────────────────────────────────┐     │
│   │  nylas.service.ts (Business logic + API)     │     │
│   └──────────────┬───────────────────────────────┘     │
│                  │                                       │
│                  │ Smart defaults + validation           │
│                  ▼                                       │
│   ┌──────────────────────────────────────────────┐     │
│   │  translations/en.json (UI metadata)          │     │
│   └──────────────────────────────────────────────┘     │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ HTTPS API calls
                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Nylas API v3                            │
│          (Email & Calendar Provider)                     │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- Follows existing integration pattern (Jira, Twilio, etc.)
- Three-layer architecture: Actions → Service → API
- Translations for user-friendly UI display

---

### 3. Code Walkthrough (20 minutes)

#### File 1: `nylas.actions.ts` (592 lines)

**Open in VS Code: `src/integrations/nylas/nylas.actions.ts`**

**Navigate to key sections:**

**Email Actions (lines ~20-150):**
```typescript
// Show nylasGetEmails action
{
  id: 'nylasGetEmails',
  inputDefinition: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Filter by subject' },
      from: { type: 'string', description: 'Filter by sender' },
      limit: { type: 'number', description: 'Max emails' }
    }
  }
}
```

**Say:**
> "Each action defines input schema, output schema, and delegates to the service layer. Notice the JSON schema validation - this ensures AI assistants pass valid parameters."

**Calendar Actions (lines ~150-550):**
```typescript
// Scroll to nylasListEvents
// Point out smart defaults documentation
```

**Say:**
> "Calendar actions include advanced features like conflict detection, free/busy checking, and batch operations. The service layer handles date range defaults automatically."

**Ask team:**
- "Any questions about the action definitions?"
- "Should we add more validation?"

---

#### File 2: `nylas.service.ts` (575 lines)

**Open in VS Code: `src/integrations/nylas/nylas.service.ts`**

**Navigate to key sections:**

**Smart Date Defaults (lines ~100-120):**
```typescript
// Show the date range logic
const now = Date.now();
const sevenDaysAgo = now - (7 * 24 * 60 * 60);
const thirtyDaysLater = now + (30 * 24 * 60 * 60);

console.log('[nylasListEvents] Using date range:', {
  starts_after: sevenDaysAgo,
  starts_before: thirtyDaysLater
});
```

**Say:**
> "This is a key feature - when users ask 'show my calendar events' without specifying dates, we default to last 7 days + next 30 days. This prevents returning ancient events from 2023."

**Error Handling (lines ~200-250):**
```typescript
// Show try/catch blocks and error messages
```

**Say:**
> "All Nylas API calls are wrapped in try/catch with detailed error logging. This helps debugging when API keys are misconfigured or API calls fail."

**Ask team:**
- "Is 7 days past + 30 days future the right default?"
- "Should we make this configurable per company?"
- "Any concerns about error handling?"

---

#### File 3: `translations/en.json` (119 lines)

**Open in VS Code: `src/integrations/nylas/translations/en.json`**

**Show a few examples:**
```json
{
  "nylasGetEmails": {
    "actionTitle": "Get Emails",
    "actionDescription": "Retrieve emails from inbox with optional filtering",
    "parameters": {
      "subject": "Email subject to search for",
      "from": "Sender email address"
    }
  }
}
```

**Say:**
> "These translations provide user-friendly names and descriptions in the Portal UI. When admins configure assistants, they see 'Get Emails' instead of 'nylasGetEmails'."

**Ask team:**
- "Are the descriptions clear for non-technical users?"
- "Should we add examples?"

---

### 4. Live Demonstration (10 minutes)

**Share terminal window**

**Test 1: Action Discovery**
```bash
node test-discovery-api.js
```

**Expected output:**
```
Total actions found: 135
Nylas actions found: 14 ✅
```

**Say:**
> "All 14 Nylas actions are successfully discovered by the system. They're now available for AI assistants to use."

---

**Test 2: Integration Endpoint (if API route exists)**
```bash
# Generate token
node get-screen-bites-token.js

# Test integrations
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/integrations
```

**Say:**
> "Once we add Nylas API keys to a company, these actions become functional. Right now they're loaded but won't execute without credentials."

---

**Test 3: Database Check**
```bash
mongosh "$MONGODB_URI" --eval "
  db.companies.findOne({ name: 'Screen Bites' }).api_keys
"
```

**Say:**
> "Notice there are no 'nylas_api_key' or 'nylas_grant_id' entries yet. That's the next step for any company wanting to use this integration."

---

### 5. Discussion Points (5 minutes)

**Questions for the team:**

1. **Security:**
   - "Are API keys properly encrypted in the database?"
   - "Should we add rate limiting for Nylas API calls?"

2. **Error Handling:**
   - "What should happen if Nylas API is down?"
   - "Should we cache calendar events?"

3. **Testing:**
   - "Should we add unit tests for the service layer?"
   - "Do we need integration tests with Nylas sandbox?"

4. **Documentation:**
   - "Should we create a setup guide for admins?"
   - "Do we need to document Nylas API v3 specifics?"

5. **Performance:**
   - "Should we paginate email/calendar results?"
   - "Do we need webhook support for real-time updates?"

---

### 6. Next Steps & Action Items (5 minutes)

**Assign ownership:**

- [ ] **Igor:** Add Nylas credentials to test company
- [ ] **[Name]:** Review and approve PR #42
- [ ] **[Name]:** Test in staging environment
- [ ] **[Name]:** Create admin documentation
- [ ] **[Name]:** Add monitoring/logging for Nylas API calls
- [ ] **[Name]:** Test with Calendar Genius assistant

**Timeline:**
- Code review approval: Today
- Staging deployment: Tomorrow
- Production deployment: [Date]

---

## 📊 Key Metrics to Track Post-Merge

1. **Action Usage:**
   - Which Nylas actions are most used?
   - Email vs Calendar usage ratio?

2. **Performance:**
   - Average Nylas API response time
   - Error rates

3. **Cost:**
   - Nylas API call volume
   - Cost per company/user

---

## 🔗 Quick Reference Links

- **PR #42:** https://github.com/singularitybridge/sb-api-services-v2/pull/42
- **Nylas API Docs:** https://developer.nylas.com/docs/api/
- **Project Branch:** `agent-mcp` (merged)
- **Testing Script:** `test-discovery-api.js`

---

## 💡 Pro Tips for Code Review

1. **Pause for questions** after each file
2. **Share your screen** for live demo
3. **Use VS Code's split view** to compare similar functions
4. **Have Terminal ready** for quick tests
5. **Take notes** on feedback in a shared doc
6. **Record the meeting** for team members who can't attend

