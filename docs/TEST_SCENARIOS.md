# Nylas Grant Management - Test Scenarios

This document provides comprehensive test scenarios for validating the Nylas grant management integration. Each scenario includes setup requirements, test steps, expected results, and verification procedures.

---

## Scenario 1: Admin Creates Calendar Event for Team Member

### Overview
Test that administrators can create calendar events directly in team members' calendars using the `userEmail` parameter. This is a key feature for administrative calendar control.

### Setup
```json
{
  "admin": {
    "email": "admin@testcompany.com",
    "role": "Admin",
    "hasGrant": true,
    "grantId": "admin-grant-123456"
  },
  "teamMember": {
    "email": "user@testcompany.com",
    "role": "CompanyUser",
    "hasGrant": true,
    "grantId": "user-grant-456789"
  }
}
```

### Test Steps

1. **Login as Admin**
   - User: admin@testcompany.com
   - Role: Admin

2. **Execute AI Action**
   - Action: `nylasCreateCalendarEvent`
   - Natural Language: "Create meeting 'Daily Standup' for user user@testcompany.com tomorrow at 9am for 15 minutes"

   OR using parameters:
   ```json
   {
     "title": "Daily Standup",
     "userEmail": "user@testcompany.com",
     "startTime": "2025-01-17T09:00:00Z",
     "endTime": "2025-01-17T09:15:00Z",
     "description": "Daily team sync"
   }
   ```

### Expected Results

✅ **Permission Check Passes**
- Admin role verified
- No ActionValidationError thrown

✅ **Grant Resolution**
- System resolves user@testcompany.com's grant
- Uses grantId: "user-grant-456789"
- NOT the admin's grant

✅ **V3 Service Call**
```http
POST /api/v1/nylas/calendar/events
{
  "grantId": "user-grant-456789",
  "title": "Daily Standup",
  "startTime": "2025-01-17T09:00:00Z",
  "endTime": "2025-01-17T09:15:00Z"
}
```

✅ **Event Created Successfully**
- Event ID returned
- Event visible in user@testcompany.com's calendar
- No invitation sent (direct creation)

### Verification

1. **Check Backend Logs**
   ```bash
   tail -50 logs/app.log | grep -E "nylasCreateCalendarEvent|grantId"
   ```
   - Verify correct grantId used: "user-grant-456789"
   - No errors in grant resolution

2. **Check V3 Service Logs**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND textPayload:user-grant-456789" --limit 10
   ```
   - Confirm V3 received correct grantId
   - Event creation successful

3. **Check User's Calendar**
   - Login to Google Calendar as user@testcompany.com
   - Verify "Daily Standup" event appears at 9am tomorrow
   - Organizer: admin@testcompany.com
   - Status: Confirmed (not pending acceptance)

### Edge Cases

**Edge Case 1: User Without Grant**
- Input: userEmail for user without grant
- Expected: Error with suggestion to send invitation

**Edge Case 2: Non-Admin Attempts**
- Input: CompanyUser tries to use userEmail parameter
- Expected: ActionValidationError "Only administrators can create events in other users' calendars"

**Edge Case 3: Cross-Company Access**
- Input: Admin tries to create event for user in different company
- Expected: Grant not found, operation fails

---

## Scenario 2: User Reads Their Own Emails

### Overview
Test that regular users can read their own emails using per-user grant resolution without specifying `userEmail` parameter.

### Setup
```json
{
  "user": {
    "email": "user@testcompany.com",
    "role": "CompanyUser",
    "hasGrant": true,
    "grantId": "user-grant-456789"
  }
}
```

### Test Steps

1. **Login as Regular User**
   - User: user@testcompany.com
   - Role: CompanyUser

2. **Execute AI Action**
   - Action: `nylasGetEmails`
   - Natural Language: "Show me my recent emails"

   OR using parameters:
   ```json
   {
     "limit": 10
   }
   ```

### Expected Results

✅ **Permission Check Passes**
- User can read their own emails
- No admin role required

✅ **Grant Resolution**
- System resolves current user's grant
- Uses grantId: "user-grant-456789"
- userEmail parameter not provided (defaults to current user)

✅ **V3 Service Call**
```http
GET /api/v1/nylas/email/messages?grantId=user-grant-456789&limit=10
```

✅ **Emails Retrieved Successfully**
- List of emails returned
- From user@testcompany.com's inbox
- No cross-user data leakage

### Verification

1. **Check Response**
   ```json
   {
     "success": true,
     "emails": [
       {
         "id": "msg-001",
         "subject": "Test Email",
         "from": { "email": "sender@example.com" },
         "date": "2025-01-16T10:00:00Z"
       }
     ]
   }
   ```

2. **Verify Grant Resolution Logs**
   ```bash
   grep "Grant resolved for user" logs/app.log | tail -5
   ```
   - Confirm correct user's grant used
   - No company default grant fallback

3. **Check Gmail Inbox**
   - Login to Gmail as user@testcompany.com
   - Verify emails match API response
   - Confirm no emails from other users visible

### Edge Cases

**Edge Case 1: User Without Grant**
- Input: User without grant tries to read emails
- Expected: Error "You do not have an active Nylas grant. Please contact your administrator."

**Edge Case 2: Company Default Grant**
- Input: User without grant, but company has default grant
- Expected: Falls back to company default grant (if configured)

**Edge Case 3: Expired Grant**
- Input: User's grant has expired
- Expected: Error from V3 service indicating grant expired

---

## Scenario 3: Admin Sends Invitation to New User

### Overview
Test the complete invitation flow: admin sends invitation, user receives email, completes OAuth, grant is linked.

### Setup
```json
{
  "admin": {
    "email": "admin@testcompany.com",
    "role": "Admin",
    "hasGrant": true
  },
  "newUser": {
    "email": "newuser@testcompany.com",
    "exists": false
  }
}
```

### Test Steps

1. **Login as Admin**
   - User: admin@testcompany.com
   - Role: Admin

2. **Execute AI Action**
   - Action: `nylasSendInvitation`
   - Natural Language: "Send Nylas invitation to newuser@testcompany.com"

   OR using parameters:
   ```json
   {
     "email": "newuser@testcompany.com",
     "firstName": "New",
     "lastName": "User"
   }
   ```

3. **Check Email**
   - Check newuser@testcompany.com's inbox
   - Verify invitation email received

4. **Complete OAuth Flow**
   - Click OAuth link in email
   - Select Google/Outlook account
   - Authorize email, calendar, contacts access

5. **Verify Grant Created**
   - Check database for new NylasGrant record
   - Verify invitation status changed to "accepted"

### Expected Results

✅ **Permission Check Passes**
- Admin role verified
- Only admins can send invitations

✅ **Email Validation**
```typescript
validator.isEmail("newuser@testcompany.com") === true
```

✅ **Invitation Created**
```json
{
  "email": "newuser@testcompany.com",
  "companyId": "company-test-001",
  "invitedBy": "user-admin-001",
  "inviteToken": "secure-token-abc123",
  "status": "pending",
  "expiresAt": "2025-01-23T00:00:00Z",
  "role": "CompanyUser"
}
```

✅ **Email Sent via SendGrid**
- Subject: "You're invited to connect your email"
- Contains OAuth URL with invite token
- Expires in 7 days notice

✅ **AI Response**
```json
{
  "success": true,
  "message": "Invitation sent successfully to newuser@testcompany.com. The invitation expires in 7 days.",
  "invitation": {
    "email": "newuser@testcompany.com",
    "expiresAt": "2025-01-23T00:00:00Z",
    "oauthUrl": "https://sb-api-services-v3-53926697384.us-central1.run.app/oauth/nylas?token=secure-token-abc123"
  }
}
```

### Verification

1. **Database Check - Invitation**
   ```javascript
   db.invites.findOne({ email: "newuser@testcompany.com" })
   ```
   - Status: "pending"
   - ExpiresAt: 7 days from now
   - Unique invite token generated

2. **SendGrid Logs**
   ```bash
   # Check SendGrid activity
   curl -X GET "https://api.sendgrid.com/v3/messages?limit=10" \
     -H "Authorization: Bearer $SENDGRID_API_KEY"
   ```
   - Verify email sent
   - To: newuser@testcompany.com
   - Status: delivered

3. **After OAuth Completion**
   ```javascript
   db.nylasgrants.findOne({ email: "newuser@testcompany.com" })
   ```
   - Grant created
   - Linked to user

   ```javascript
   db.invites.findOne({ email: "newuser@testcompany.com" })
   ```
   - Status: "accepted"
   - AcceptedAt: timestamp

### Edge Cases

**Edge Case 1: Invalid Email**
- Input: "not-an-email"
- Expected: ActionValidationError "Valid email address is required"

**Edge Case 2: Duplicate Invitation**
- Input: Email already has pending invitation
- Expected: Error "Invitation already sent to this email"

**Edge Case 3: Rate Limiting**
- Input: 11 invitations in 1 hour
- Expected: Rate limit error "Too many invitations sent. Please try again later."

**Edge Case 4: Non-Admin Attempts**
- Input: CompanyUser tries to send invitation
- Expected: ActionValidationError "Only administrators can send Nylas invitations"

---

## Scenario 4: Non-Admin Attempts Admin Action

### Overview
Test that permission checks correctly prevent non-admin users from executing admin-only actions.

### Setup
```json
{
  "regularUser": {
    "email": "user@testcompany.com",
    "role": "CompanyUser",
    "hasGrant": true
  }
}
```

### Test Steps

1. **Login as Regular User**
   - User: user@testcompany.com
   - Role: CompanyUser (NOT Admin)

2. **Attempt Admin Action: List Company Grants**
   - Action: `nylasListCompanyGrants`
   - Natural Language: "List all company grants"

3. **Attempt Admin Action: Send Invitation**
   - Action: `nylasSendInvitation`
   - Parameters:
   ```json
   {
     "email": "newuser@testcompany.com"
   }
   ```

4. **Attempt Admin Action: Revoke Grant**
   - Action: `nylasRevokeGrant`
   - Parameters:
   ```json
   {
     "userEmail": "admin@testcompany.com"
   }
   ```

5. **Attempt Admin Action: Check Other User's Grant**
   - Action: `nylasCheckGrantStatus`
   - Parameters:
   ```json
   {
     "userEmail": "admin@testcompany.com"
   }
   ```

### Expected Results

❌ **List Company Grants - DENIED**
```json
{
  "error": "ActionValidationError: Only administrators can list company grants"
}
```

❌ **Send Invitation - DENIED**
```json
{
  "error": "ActionValidationError: Only administrators can send Nylas invitations"
}
```

❌ **Revoke Grant - DENIED**
```json
{
  "error": "ActionValidationError: Only administrators can revoke Nylas grants"
}
```

❌ **Check Other User's Grant - DENIED**
```json
{
  "error": "ActionValidationError: Only administrators can check grant status for other users"
}
```

✅ **Check Own Grant - ALLOWED**
- Action: nylasCheckGrantStatus (no userEmail parameter)
- Expected: Success, returns user's own grant status

### Verification

1. **Check Audit Logs**
   ```bash
   grep "ActionValidationError" logs/app.log | grep "user@testcompany.com"
   ```
   - All 4 admin actions blocked
   - Clear error messages logged

2. **Verify No Data Exposure**
   - No grant information returned in errors
   - No enumeration of users or emails
   - Generic error messages prevent information leakage

3. **Confirm Security**
   ```bash
   # Check that permission checks happen BEFORE any database queries
   grep -B 5 "Only administrators" src/integrations/nylas/nylas.actions.ts
   ```
   - Permission check is first operation
   - No data fetched before authorization

### Edge Cases

**Edge Case 1: User Checks Own Grant**
- Input: No userEmail parameter
- Expected: ✅ Success (users can check their own status)

**Edge Case 2: Attempt REST API Bypass**
- Input: Direct REST call to /api/nylas/company-grants/:companyId without auth
- Expected: 401 Unauthorized (verifyTokenMiddleware blocks)

**Edge Case 3: Attempt REST API as Non-Admin**
- Input: Authenticated REST call as CompanyUser
- Expected: 403 Forbidden (role check blocks)

---

## Scenario 5: Grant Status Check with Auto-Suggestion

### Overview
Test that when checking a user's grant status and no grant is found, the AI automatically suggests sending an invitation.

### Setup
```json
{
  "admin": {
    "email": "admin@testcompany.com",
    "role": "Admin",
    "hasGrant": true
  },
  "userWithoutGrant": {
    "email": "noauth@testcompany.com",
    "role": "CompanyUser",
    "hasGrant": false
  }
}
```

### Test Steps

1. **Login as Admin**
   - User: admin@testcompany.com
   - Role: Admin

2. **Execute AI Action**
   - Action: `nylasCheckGrantStatus`
   - Natural Language: "Check grant status for noauth@testcompany.com"

   OR using parameters:
   ```json
   {
     "userEmail": "noauth@testcompany.com"
   }
   ```

### Expected Results

✅ **Permission Check Passes**
- Admin can check other users' grants

✅ **Grant Not Found**
```json
{
  "success": true,
  "hasGrant": false,
  "grant": null
}
```

✅ **AI Auto-Suggestion**
- AI analyzes response
- Detects no grant found
- Suggests: "User noauth@testcompany.com does not have an active Nylas grant. Would you like me to send them an invitation?"
- Proactive, helpful behavior

### Verification

1. **Check AI Response**
   - Contains suggestion message
   - Offers to send invitation
   - User-friendly language

2. **Test Follow-Up**
   - User responds: "Yes, send invitation"
   - AI executes: nylasSendInvitation action
   - Invitation sent successfully

3. **Verify Grant Status After Invitation**
   - Check invite status: "pending"
   - User receives email
   - After OAuth: grant created, status changes to "active"

### Edge Cases

**Edge Case 1: User Exists but Grant Expired**
- Grant status: "expired"
- Expected: Suggest sending new invitation

**Edge Case 2: Grant Revoked**
- Grant status: "revoked"
- Expected: Explain grant was revoked, suggest new invitation

**Edge Case 3: Multiple Checks in Conversation**
- User checks 5 users without grants
- Expected: AI offers batch invitation option

---

## Test Execution Checklist

### Prerequisites
- [ ] MongoDB running with test data
- [ ] V3 microservice accessible
- [ ] SendGrid configured for invitations
- [ ] Test users created (admin and regular)
- [ ] Test grants configured

### Scenario Execution
- [ ] Scenario 1: Admin Calendar Creation ✅
- [ ] Scenario 2: User Reads Emails ✅
- [ ] Scenario 3: Admin Sends Invitation ✅
- [ ] Scenario 4: Permission Checks ✅
- [ ] Scenario 5: Auto-Suggestion ✅

### Cross-Cutting Concerns
- [ ] All error messages user-friendly
- [ ] No sensitive data in logs
- [ ] Performance acceptable (<1s for grant resolution)
- [ ] Audit trail complete
- [ ] Cross-company isolation verified

### Post-Test Cleanup
```bash
# Remove test invitations
db.invites.deleteMany({ email: /testcompany\.com$/ })

# Remove test grants
db.nylasgrants.deleteMany({ email: /testcompany\.com$/ })

# Keep test users for future tests
```

---

## Success Criteria

✅ **All 5 scenarios pass without errors**
✅ **Permission checks work correctly**
✅ **Grant resolution chain functions properly**
✅ **V3 microservice integration successful**
✅ **AI suggestions are helpful and accurate**
✅ **No security vulnerabilities detected**
✅ **Documentation matches actual behavior**

---

**Ready for Meir to test with personal assistant project!** 🎉
