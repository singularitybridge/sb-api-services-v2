# Cross-User Contact Management - Implementation Guide

**Status:** ✅ Working
**Date:** December 2, 2025
**Version:** 1.0

---

## Overview

Successfully implemented admin-based cross-user contact management system where an admin user (iamagentshimi@gmail.com) can:
1. View any team member's Google Contacts
2. Create contacts in any team member's Google Contacts
3. Manage contacts across the entire company

### Core Architecture

**Service Account Approach:**
- Admin connects their Google account via OAuth
- Admin gets permanent Nylas grant
- Regular users (like Igor) get OAuth grants but DON'T need to use the platform
- Regular users continue using Gmail/Google Contacts normally
- Admin accesses all users' contacts through the agent platform

---

## Problem Solved: Parameter Confusion

### The Issue
AI agents (GPT-4o-mini) were confusing parameter names when asked to access another user's account:

**User request:** "Show me Igor's contacts"

**Wrong interpretation:**
```javascript
nylasGetContacts({ email: "igorh@aidgenomics.com" })
// This searches MY contacts for ones WITH email "igorh@aidgenomics.com"
```

**Correct interpretation:**
```javascript
nylasGetContacts({ accountOwnerEmail: "igorh@aidgenomics.com" })
// This accesses IGOR'S Google Contacts account
```

### Root Cause
Parameter names were semantically ambiguous:
- `email` - Could mean "filter by email" OR "whose account"
- `targetEmail` - Still confusing to AI models

### The Solution: Semantic Clarity

Renamed parameters to be unambiguous:

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `email` | `filterByEmail` | OPTIONAL: Search within contacts for specific email |
| `targetEmail` | `accountOwnerEmail` | REQUIRED: Whose Google account to access |

---

## Code Changes

### 1. Action Definitions

**File:** `src/integrations/nylas/contacts/contacts.actions.ts`

#### nylasGetContacts Action

```typescript
nylasGetContacts: {
  description:
    'Retrieve contacts from a Google Contacts account. CRITICAL: Use accountOwnerEmail to access ANOTHER user\'s Google account. Use filterByEmail only to search within contacts.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of contacts to return (default: 50)',
      },
      filterByEmail: {
        type: 'string',
        description: 'OPTIONAL FILTER: Search within the contacts list for contacts that have this email. This does NOT determine whose account to access.',
      },
      accountOwnerEmail: {
        type: 'string',
        description: 'WHOSE GOOGLE ACCOUNT to access. Use this when user says "Igor\'s contacts" or "contacts for igorh@aidgenomics.com". Example: accountOwnerEmail: "igorh@aidgenomics.com" accesses Igor\'s Google Contacts. If omitted, accesses current user\'s own Google Contacts.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  function: async (args: {
    limit?: number;
    filterByEmail?: string;
    accountOwnerEmail?: string;
  }): Promise<StandardActionResult<ContactData[]>> => {
    const { limit = 50, filterByEmail, accountOwnerEmail } = args;

    // Map new parameter names to backend logic
    const email = filterByEmail;
    const targetEmail = accountOwnerEmail;

    // ... rest of implementation
  }
}
```

#### nylasCreateContact Action

```typescript
nylasCreateContact: {
  description:
    'Create a new contact in Google Contacts with name, email, phone, company, and notes. Admins can create contacts in other users\' accounts by providing accountOwnerEmail.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address of the contact to create (required)',
      },
      givenName: {
        type: 'string',
        description: 'First name (optional)',
      },
      surname: {
        type: 'string',
        description: 'Last name (optional)',
      },
      phone: {
        type: 'string',
        description: 'Phone number (optional)',
      },
      companyName: {
        type: 'string',
        description: 'Company name (optional)',
      },
      notes: {
        type: 'string',
        description: 'Additional notes (optional)',
      },
      accountOwnerEmail: {
        type: 'string',
        description: 'WHOSE GOOGLE ACCOUNT to create the contact in. Use this when creating contacts for another user. If not provided, creates in your own account.',
      },
    },
    required: ['email'],
    additionalProperties: false,
  },
  function: async (args: {
    email: string;
    givenName?: string;
    surname?: string;
    phone?: string;
    companyName?: string;
    notes?: string;
    accountOwnerEmail?: string;
  }): Promise<StandardActionResult<ContactData>> => {
    const { email, givenName, surname, phone, companyName, notes, accountOwnerEmail } = args;

    // Map new parameter name to backend logic
    const targetEmail = accountOwnerEmail;

    // ... rest of implementation
  }
}
```

### 2. Agent Prompt

**File:** `contacts-dev-agent-prompt.txt`

Key sections:

#### Understanding accountOwnerEmail vs filterByEmail

```markdown
⚠️ **CRITICAL: Understanding accountOwnerEmail vs filterByEmail Parameter**

These are TWO COMPLETELY DIFFERENT parameters - DO NOT CONFUSE THEM:

1. **`accountOwnerEmail`** = WHOSE Google Contacts account to access
   - Use this to access ANOTHER user's Google Contacts
   - Example: `{ accountOwnerEmail: "igor@example.com" }` = Access Igor's Google account
   - This is the PRIMARY parameter for cross-user access

2. **`filterByEmail`** = OPTIONAL FILTER to search within contacts
   - Use this ONLY to search for contacts that HAVE a specific email address
   - This does NOT determine whose account to access
   - Example: `{ accountOwnerEmail: "igor@example.com", filterByEmail: "john@company.com" }` = Search Igor's contacts for John
```

#### Intent Recognition Patterns

```markdown
### Viewing Contacts
When users mention another person's name or email, they want cross-user access:

- "Igor's contacts" → accountOwnerEmail: "igorh@aidgenomics.com"
- "contacts of igorh@aidgenomics.com" → accountOwnerEmail: "igorh@aidgenomics.com"
- "Avi's contacts" → accountOwnerEmail: "avi@singularitybridge.net"
- "contacts for salem@aidgenomics.com" → accountOwnerEmail: "salem@aidgenomics.com"

### Creating Contacts FOR Another User
When users say "send to", "add to", "create in", or "copy to" another user, they want to CREATE in that user's account:

- "send to Igor" → accountOwnerEmail: "igorh@aidgenomics.com"
- "add to Igor's contacts" → accountOwnerEmail: "igorh@aidgenomics.com"
- "create in Igor's account" → accountOwnerEmail: "igorh@aidgenomics.com"
- "copy to Avi" → accountOwnerEmail: "avi@singularitybridge.net"
- "share with salem@aidgenomics.com" → accountOwnerEmail: "salem@aidgenomics.com"
```

#### Example Scenarios

```markdown
**Scenario: View another user's contacts**
User: "Show me Igor's contacts"
You: [Call nylasGetContacts({ accountOwnerEmail: "igorh@aidgenomics.com" })]
     "Here are Igor's contacts: ..."

**Scenario: Send contacts to another user**
User: "Send to Igor my 3 first contacts"
You: [Step 1: Get my contacts: nylasGetContacts()]
     [Step 2: For each of the 3 contacts, create in Igor's account:]
     nylasCreateContact({
       accountOwnerEmail: "igorh@aidgenomics.com",
       givenName: "Leah",
       surname: "Weiss",
       email: "lea.weiss@example.com",
       notes: "Patient"
     })
     "I've sent your 3 contacts to Igor's Google account (igorh@aidgenomics.com)."
```

---

## Database Configuration

### Users

**Admin User:**
```javascript
{
  _id: "692d88c9d62a0d839367d09c",
  email: "iamagentshimi@gmail.com",
  companyId: "692d88c9d62a0d839367d082",
  role: "Admin"
}
```

**Regular User (Igor):**
```javascript
{
  _id: "690b1940455d30f7a1c10045",
  email: "igorh@aidgenomics.com",
  companyId: "692d88c9d62a0d839367d082",
  role: "User" // or other non-Admin role
}
```

### Nylas Grants

**Igor's Grant:**
```javascript
{
  nylasGrantId: "34949d41-1dbf-4871-a51c-39f04457d0a2",
  emailAddress: "igorh@aidgenomics.com",
  companyId: "692d88c9d62a0d839367d082",
  userId: "690b1940455d30f7a1c10045",
  status: "active",
  isActive: true
}
```

### Assistant Configuration

**Agent ID:** `692d8c3b61cf1e4baaaa5bef`
**Agent Name:** `contacts-dev-agent`
**Model:** `gpt-4o-mini`

**Actions:**
1. nylas.nylasGetContacts
2. nylas.nylasCreateContact
3. nylas.nylasUpdateContact
4. nylas.nylasGetContactById
5. nylas.nylasDeleteContact
6. nylas.nylasSearchContacts
7. nylas.nylasFindDuplicates
8. nylas.nylasSearchContactsByTags
9. nylas.nylasSearchContactsByLifecycle
10. nylas.nylasGetGrants

---

## Testing Procedures

### Test 1: View Own Contacts

**User says:** "Show me my contacts"

**Expected:**
- Agent calls: `nylasGetContacts({ limit: 50 })`
- Returns: Admin's own contacts (30+ contacts)

### Test 2: View Another User's Contacts

**User says:** "Show me Igor's contacts" OR "Show me contacts for igorh@aidgenomics.com"

**Expected:**
- Agent calls: `nylasGetContacts({ accountOwnerEmail: "igorh@aidgenomics.com" })`
- Returns: Igor's 6 real Google Contacts:
  - Emil Rafidi (emil@aidgenomics.com)
  - Ricardo Henriquez (ricardo@aidgenomics.com)
  - Tanya Hodosevich (tanya@ehs.co.il)
  - igor (×3 duplicates, no email)

### Test 3: Send Contacts to Another User

**User says:** "Send to Igor my first 2 contacts"

**Expected:**
- Agent calls: `nylasGetContacts()` to get admin's contacts
- For each contact, calls:
  ```javascript
  nylasCreateContact({
    accountOwnerEmail: "igorh@aidgenomics.com",
    email: "lea.weiss@example.com",
    givenName: "Leah",
    surname: "Weiss"
  })
  ```
- New contacts appear in Igor's Google Contacts at https://contacts.google.com

### Test 4: Compare Contacts

**User says:** "Which contacts do I have that Igor doesn't?"

**Expected:**
- Agent calls: `nylasGetContacts()` (admin's contacts)
- Agent calls: `nylasGetContacts({ accountOwnerEmail: "igorh@aidgenomics.com" })` (Igor's contacts)
- Returns: List of contacts admin has but Igor doesn't

---

## Backend Grant Resolution

**File:** `src/services/nylas-grant-resolution.service.ts`

The system automatically resolves grants based on `accountOwnerEmail`:

```typescript
export async function resolveTargetUserGrant(
  companyId: string,
  adminUserId: string,
  targetEmail?: string
): Promise<GrantResolutionResult> {

  if (!targetEmail) {
    // No targetEmail = use admin's own grant
    return {
      grantId: adminGrantId,
      targetUserId: adminUserId,
      isAdminAccess: false
    };
  }

  // Find target user by email
  const targetUser = await User.findOne({
    email: targetEmail,
    companyId
  });

  // Find target user's grant
  const targetAccount = await NylasAccount.findOne({
    emailAddress: targetEmail,
    companyId,
    isActive: true
  });

  return {
    grantId: targetAccount.nylasGrantId,
    targetUserId: targetUser._id,
    isAdminAccess: true  // Admin accessing another user's account
  };
}
```

---

## Admin Audit Logging

All cross-user actions are logged:

```javascript
{
  adminUserId: "692d88c9d62a0d839367d09c",
  targetUserId: "690b1940455d30f7a1c10045",
  companyId: "692d88c9d62a0d839367d082",
  actionName: "nylasGetContacts",
  targetEmail: "igorh@aidgenomics.com",
  timestamp: "2025-12-02T11:28:00Z"
}
```

**Log Message:**
```
[ADMIN AUDIT] Admin 692d88c9d62a0d839367d09c accessed 690b1940455d30f7a1c10045's contact (nylasGetContacts)
```

---

## Environment Setup

### Required Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/avi-dev

# Nylas
NYLAS_API_KEY=your_nylas_api_key
NYLAS_CLIENT_ID=your_client_id
NYLAS_CLIENT_SECRET=your_client_secret
NYLAS_REDIRECT_URI=http://localhost:5173/oauth/callback

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### Server Startup

**Terminal 1 - Backend:**
```bash
cd /Users/igor/agent_test_api_mcp/sb-api-services-v2
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd /Users/igor/agent_test_api_mcp/sb-chat-ui
npm run dev
# Runs on http://localhost:5173
```

**MongoDB:**
```bash
brew services start mongodb-community
```

---

## Key Learnings

### 1. Parameter Naming is Critical
Generic names like `email` and `targetEmail` caused AI confusion. Descriptive names like `accountOwnerEmail` and `filterByEmail` eliminated ambiguity.

### 2. Action Descriptions Matter
Clear, explicit descriptions in action schemas help AI models understand intent:
- ✅ "WHOSE GOOGLE ACCOUNT to access"
- ❌ "Target user's email"

### 3. Intent Pattern Recognition
Teaching the AI specific patterns works better than generic instructions:
- "send to Igor" → accountOwnerEmail
- "Igor's contacts" → accountOwnerEmail
- "add to Igor" → accountOwnerEmail

### 4. Multiple Assistants Issue
Always verify which assistant ID is actually being used in sessions. We had two assistants with similar names, causing confusion during updates.

---

## Next Steps

### Potential Enhancements

1. **Bulk Operations**
   - "Copy all my contacts to the whole team"
   - "Share contact group with multiple users"

2. **Contact Groups**
   - Create groups in other users' accounts
   - Share entire groups between users

3. **Bi-Directional Sync**
   - "Keep my contacts synced with Igor's"
   - Automatic duplicate detection

4. **Advanced Filters**
   - "Show me contacts Igor has that I don't"
   - "Find duplicates across all team members"

5. **UI Dashboard**
   - Visual contact management
   - Bulk selection and operations
   - Cross-user contact comparison view

---

## Troubleshooting

### Issue: Agent uses filterByEmail instead of accountOwnerEmail

**Solution:**
1. Verify correct assistant ID is being updated
2. Refresh browser to clear cached action schemas
3. Start new chat session (old sessions cache prompts)

### Issue: Contacts not appearing in Google

**Solution:**
1. Verify grant is active: Check NylasAccount.isActive
2. Check grant resolution logs: Look for `[GRANT RESOLUTION]` in backend logs
3. Verify accountOwnerEmail matches exact email in database

### Issue: Permission denied

**Solution:**
1. Verify admin has "Admin" role in User model
2. Verify both users in same companyId
3. Check audit logs for access attempts

---

## Files Modified

### Backend
1. `src/integrations/nylas/contacts/contacts.actions.ts` - Action definitions
2. `src/integrations/nylas/contacts/contacts.service.ts` - Service layer
3. `src/services/nylas-grant-resolution.service.ts` - Grant resolution

### Agent
1. `contacts-dev-agent-prompt.txt` - Agent system prompt

### Documentation
1. `CROSS_USER_CONTACTS_IMPLEMENTATION.md` - This file
2. `START_ALL_SERVERS.md` - Server startup guide

---

## Success Metrics

- ✅ Admin can view any user's contacts
- ✅ Admin can create contacts in any user's account
- ✅ Correct parameter usage (accountOwnerEmail vs filterByEmail)
- ✅ Grant resolution working for all team members
- ✅ Audit logging functioning
- ✅ No parameter confusion in 10+ test interactions

---

**Last Updated:** December 2, 2025
**Maintained By:** Development Team
**Status:** Production Ready
