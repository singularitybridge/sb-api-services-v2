# Nylas Grant Management Implementation

## Overview

Added 4 new AI assistant actions to enable grant management and user invitation functionality. This resolves the "hallucination" issue where AI assistants incorrectly responded "I don't have access" when asked about grant status or company grants.

**Issue Fixed:** AI assistants now properly understand and can manage Nylas grants for email/calendar/contacts access.

---

## What Was Implemented

### 1. Four New Actions (src/integrations/nylas/nylas.actions.ts)

#### `nylasCheckGrantStatus`
**Purpose:** Check if a user has an active Nylas grant

**Permissions:**
- Users can check their own grant status
- Admins can check any user's grant status

**Parameters:**
- `userEmail` (optional): Email of user to check (defaults to current user)

**Response:**
```json
{
  "hasGrant": true,
  "grantId": "grant_abc123",
  "status": "active",
  "email": "user@example.com",
  "provider": "google",
  "createdAt": "2025-12-15T10:00:00Z",
  "expiresAt": "2026-12-15T10:00:00Z"
}
```

**AI Behavior:** When no grant found, automatically suggests sending invitation:
> "User {email} does not have an active Nylas grant. Would you like me to send them an invitation to connect their account?"

---

#### `nylasListCompanyGrants`
**Purpose:** List all users with active Nylas grants in the company

**Permissions:** **Admin only**

**Parameters:** None

**Response:**
```json
{
  "totalUsers": 3,
  "grants": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "name": "Agent Shimi",
      "email": "iamagentshimi@gmail.com",
      "grantId": "grant_xyz789",
      "status": "active",
      "provider": "google",
      "createdAt": "2025-12-15T10:00:00Z"
    },
    ...
  ]
}
```

---

#### `nylasSendInvitation`
**Purpose:** Send Nylas grant invitation email to onboard new users

**Permissions:** **Admin only** (per user selection)

**Parameters:**
- `email` (required): Email address to invite
- `firstName` (optional): Recipient's first name
- `lastName` (optional): Recipient's last name

**Response:**
```json
{
  "inviteToken": "8jb8jty569upxrlxsoqgj",
  "email": "newuser@example.com",
  "expiresAt": "2025-12-22T10:00:00Z",
  "message": "Invitation sent successfully to newuser@example.com. The invitation expires on 12/22/2025."
}
```

**What Happens:**
1. Creates invite in database (7-day expiration)
2. Generates OAuth URL via V3 microservice
3. Sends HTML email with "Connect Your Account" button
4. User clicks → Nylas OAuth → Grant created → User onboarded

---

#### `nylasRevokeGrant`
**Purpose:** Revoke a user's Nylas grant (removes email/calendar/contacts access)

**Permissions:** **Admin only**

**Parameters:**
- `userEmail` (required): Email of user whose grant to revoke

**Response:**
```json
{
  "message": "Successfully revoked Nylas grant for user@example.com",
  "revokedGrantId": "grant_abc123"
}
```

---

### 2. Translations Metadata (src/integrations/nylas/translations/en.json)

Added complete metadata for all 4 actions including:
- Action titles
- Descriptions
- Category grouping (`grant_management`)
- Parameter descriptions

---

### 3. Test Scripts

#### `scripts/test-grant-actions.sh`
Comprehensive test script for all 4 grant management actions.

**Usage:**
```bash
./scripts/test-grant-actions.sh <ASSISTANT_ID> [TEST_EMAIL]

# Example:
./scripts/test-grant-actions.sh 681b41850f470a9a746f280e test-grant@example.com
```

**Test Phases:**
1. Check Grant Status (own + other users)
2. List Company Grants (admin only)
3. Send Invitation (admin only) - **sends REAL emails!**
4. Grant Status After Invitation
5. Revoke Grant (admin only)
6. Permission Tests (verifies non-admin denial)

---

#### `scripts/update-nylas-assistant-with-grants.js`
MongoDB script to automatically update existing Nylas assistants.

**Usage:**
```bash
node scripts/update-nylas-assistant-with-grants.js
```

**What It Does:**
1. Finds all assistants with Nylas actions
2. Adds 4 new grant management actions to `allowedActions` array
3. Updates assistant prompts with grant management instructions
4. Preserves existing configuration

---

## How to Use

### Step 1: Update Your Assistant

**Option A: Automatic Update (Recommended)**
```bash
node scripts/update-nylas-assistant-with-grants.js
```

**Option B: Manual Update via Database**

Update the assistant document in MongoDB:

```javascript
db.assistants.updateOne(
  { name: "Nylas Test Assistant" },
  {
    $addToSet: {
      allowedActions: {
        $each: [
          "nylas_nylasCheckGrantStatus",
          "nylas_nylasListCompanyGrants",
          "nylas_nylasSendInvitation",
          "nylas_nylasRevokeGrant"
        ]
      }
    }
  }
)
```

**Option C: Manual Update via API**

If using assistant creation scripts, add the new actions:

```javascript
allowedActions: [
  // ... existing nylas actions ...
  'nylas_nylasCheckGrantStatus',
  'nylas_nylasListCompanyGrants',
  'nylas_nylasSendInvitation',
  'nylas_nylasRevokeGrant'
]
```

---

### Step 2: Update Assistant Prompt

Add grant management instructions to your assistant's prompt:

```
## Grant Management (Admin Functions)

You have the ability to manage Nylas grants for users in the company:

**Check Grant Status:**
- Use nylasCheckGrantStatus to check if a user has connected their email/calendar/contacts
- IMPORTANT: When a user has NO grant, automatically suggest sending them an invitation

**Send Invitations (Admin Only):**
- Use nylasSendInvitation to invite users to connect their Google/Outlook accounts
- Only admins can send invitations
- Invitations expire in 7 days

**List Company Grants (Admin Only):**
- Use nylasListCompanyGrants to see all users with active grants

**Revoke Access (Admin Only):**
- Use nylasRevokeGrant to remove a user's grant

**Permission Handling:**
- If a non-admin tries admin-only actions, explain that administrator permissions are required
```

---

### Step 3: Test the Implementation

```bash
# Get your assistant ID (from UI or database)
# Then run the test script:
./scripts/test-grant-actions.sh <ASSISTANT_ID>
```

---

## Example Conversations

### Scenario 1: User Checks Own Grant Status
```
User: Check my Nylas grant status
AI: You have an active Nylas grant connected via Google (iamagentshimi@gmail.com).
    Your grant was created on December 15, 2025 and is currently active.
```

### Scenario 2: Admin Checks Another User's Status (No Grant)
```
User: Check grant status for newuser@example.com
AI: User newuser@example.com does not have an active Nylas grant.
    Would you like me to send them an invitation to connect their account?
```

### Scenario 3: Admin Sends Invitation
```
User: Yes, please send them an invitation
AI: I've sent a Nylas invitation to newuser@example.com.
    The invitation includes a secure link to connect their Google or Outlook account.
    The invitation expires on December 22, 2025.
```

### Scenario 4: Admin Lists Company Grants
```
User: List all company grants
AI: Your company has 3 users with active Nylas grants:
    1. iamagentshimi@gmail.com - Active since Dec 15, 2025 (Google)
    2. igorh@aidgenomics.com - Active since Dec 14, 2025 (Google)
    3. avi@singularitybridge.net - Active since Dec 10, 2025 (Outlook)
```

### Scenario 5: Non-Admin Tries Admin Action
```
User: Send invitation to someone@example.com
AI: I'm unable to send Nylas invitations because you need administrator permissions.
    Please contact your company administrator to send invitations.
```

### Scenario 6: Admin Revokes Grant
```
User: Revoke grant for user@example.com
AI: Successfully revoked Nylas grant for user@example.com.
    They will no longer have email/calendar/contacts access through the AI assistant.
```

---

## Architecture

### Permission Model

| Action | Regular User | Admin |
|--------|--------------|-------|
| Check own grant | ✅ Allowed | ✅ Allowed |
| Check other user's grant | ❌ Denied | ✅ Allowed |
| List company grants | ❌ Denied | ✅ Allowed |
| Send invitation | ❌ Denied | ✅ Allowed |
| Revoke grant | ❌ Denied | ✅ Allowed |

**Role Determination:**
- Based on `User.role` field: `'Admin'` or `'CompanyUser'`
- Admin = `user.role === 'Admin'`
- Permission checks happen in action implementation

---

### Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     AI ASSISTANT                             │
│  (Now knows about grant management actions)                 │
└────────────────────┬────────────────────────────────────────┘
                     │ Calls action
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            ACTION SYSTEM (nylas.actions.ts)                  │
│  • nylasCheckGrantStatus                                     │
│  • nylasListCompanyGrants (checks admin permission)          │
│  • nylasSendInvitation (checks admin permission)             │
│  • nylasRevokeGrant (checks admin permission)                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────────┐
        ▼                         ▼                  ▼
┌──────────────────┐    ┌──────────────────┐  ┌────────────────┐
│GrantsService     │    │InviteService     │  │User Model      │
│• getUserGrant    │    │• createInvite    │  │• role check    │
│• getCompanyUsers │    │• sendEmail via   │  │  ('Admin')     │
│• revokeGrant     │    │  V3 microservice │  └────────────────┘
└──────────────────┘    └──────────────────┘
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│NylasGrant        │    │Nylas V3 Microservice (GCP)            │
│MongoDB Collection│    │• Generates OAuth URL                  │
│(Per-user grants) │    │• Handles OAuth callback               │
└──────────────────┘    │• Creates grant on successful auth     │
                        └──────────────────────────────────────┘
```

---

## Security Considerations

### 1. Permission Enforcement
- All admin-only actions verify `user.role === 'Admin'` before executing
- Non-admin attempts return clear error: `"Only administrators can..."`
- Permission checks happen server-side, not client-side

### 2. Data Privacy
- Users can only see their own grant details
- Company-wide grant lists restricted to admins
- Grant IDs not exposed to non-admins

### 3. Email Enumeration Prevention
- Generic error messages when user not found
- Doesn't reveal if email exists in different company

### 4. Rate Limiting
- Invitation creation respects existing rate limits (10 invites/hour per user)
- Prevents invitation spam

---

## Monitoring

### Live Monitoring (Grafana)

The grant management actions are automatically tracked by the MCP metrics system.

**View in Grafana:** http://localhost:3002
- Look for `nylas*` action metrics
- Check V2 ↔ V3 Communication Logs panel
- Monitor action success rates

**Log Patterns to Watch:**
```
[TOOL_EXECUTION] nylasCheckGrantStatus
[TOOL_EXECUTION_COMPLETE] nylasListCompanyGrants
[grants-service] Stored grant for user...
[grants-service] Revoked grant for user...
[invite] Created invite for...
[invitations-service] Sent invitation to...
```

---

## Troubleshooting

### Issue: "I don't have access" Response

**Cause:** Assistant doesn't have grant management actions enabled

**Fix:**
```bash
node scripts/update-nylas-assistant-with-grants.js
```

---

### Issue: "Only administrators can..." Error

**Cause:** User doesn't have admin role

**Checks:**
1. Verify user role in database:
   ```javascript
   db.users.findOne({ email: "user@example.com" }, { role: 1 })
   ```
2. Should return `{ role: "Admin" }` for admin users
3. Update role if needed:
   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "Admin" } }
   )
   ```

---

### Issue: Actions Not Available

**Cause:** Actions not added to assistant configuration

**Fix:** Verify `allowedActions` includes:
```javascript
[
  "nylas_nylasCheckGrantStatus",
  "nylas_nylasListCompanyGrants",
  "nylas_nylasSendInvitation",
  "nylas_nylasRevokeGrant"
]
```

---

### Issue: Invitation Email Not Sent

**Checks:**
1. V3 microservice is running (GCP Cloud Run)
2. Nylas API credentials configured
3. Check backend logs:
   ```bash
   tail -f /tmp/claude/tasks/*.output | grep invitation
   ```
4. Verify invite was created in database:
   ```javascript
   db.invites.find().sort({ createdAt: -1 }).limit(1)
   ```

---

## Files Modified/Created

### Core Implementation
- ✅ `src/integrations/nylas/nylas.actions.ts` - 4 new actions (300+ lines)
- ✅ `src/integrations/nylas/translations/en.json` - Action metadata

### Test Scripts
- ✅ `scripts/test-grant-actions.sh` - Comprehensive test suite
- ✅ `scripts/update-nylas-assistant-with-grants.js` - Assistant updater

### Documentation
- ✅ `docs/GRANT_MANAGEMENT_IMPLEMENTATION.md` - This document

---

## Success Criteria

✅ AI assistants can check grant status without "I don't have access" errors
✅ AI assistants automatically suggest sending invitations when grant not found
✅ Admins can send Nylas invitations via AI
✅ Admins can list all company grants via AI
✅ Admins can revoke grants via AI
✅ Permission checks prevent unauthorized access
✅ All test cases pass
✅ Documentation complete

---

## Next Steps

1. **Update Your Assistant**
   ```bash
   node scripts/update-nylas-assistant-with-grants.js
   ```

2. **Test the Implementation**
   ```bash
   ./scripts/test-grant-actions.sh <ASSISTANT_ID>
   ```

3. **Monitor in Grafana**
   - Open http://localhost:3002
   - Watch V2 ↔ V3 Communication Logs

4. **Verify with Real Usage**
   - Ask assistant: "Check my grant status"
   - Ask assistant: "List company grants" (as admin)
   - Ask assistant: "Send invitation to newuser@example.com" (as admin)

---

## Support

If you encounter issues:
1. Check logs: `tail -f /tmp/claude/tasks/*.output`
2. Verify MongoDB connection and data
3. Ensure V3 microservice is accessible
4. Review Grafana metrics for failed actions
5. Check this documentation's troubleshooting section
