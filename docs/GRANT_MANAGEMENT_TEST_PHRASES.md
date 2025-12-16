# Grant Management System - Test Phrases

Complete testing guide for all grant management functionality.

## Prerequisites
- Logged in as Admin user (iamagentshimi@gmail.com - now Admin role ✅)
- Using "Nylas Test Assistant" with all 4 grant actions enabled ✅
- Backend server running on http://localhost:8080 ✅

---

## 1. Check Grant Status (Own Account)

### Basic Queries
```
Check my Nylas grant status
```
```
Do I have a Nylas grant?
```
```
Show me my grant information
```
```
Am I connected to Nylas?
```
```
What's my email integration status?
```

### Expected Results
- If you have a grant: Shows grant details (grantId, provider, email, created date)
- If no grant: "You do not have an active Nylas grant. Contact your administrator to send you an invitation."

---

## 2. Check Grant Status (Other Users)

### Admin Queries - Checking Other Users
```
Check grant status for igorh@aidgenomics.com
```
```
Does igorh@aidgenomics.com have a Nylas grant?
```
```
Show me grant information for igorh@aidgenomics.com
```
```
Is igorh@aidgenomics.com connected to Nylas?
```
```
What's the grant status of igorh@aidgenomics.com?
```

### Expected Results
- If user has grant: Shows their grant details
- If user has NO grant: "User [email] does not have an active Nylas grant. Would you like me to send them an invitation to connect their account?"
- If user not found: "User [email] not found in your company"

---

## 3. List Company Grants (Admin Only)

### List All Grants
```
List all company grants
```
```
Show me all Nylas grants in our company
```
```
Which users have Nylas access?
```
```
Who is connected to Nylas?
```
```
Show me all users with active Nylas grants
```
```
List everyone with email integration
```

### Expected Results
- Shows array of all users with active grants
- Each entry includes: email, grantId, status, provider, createdAt
- Summary: "Your company has X users with active Nylas grants"

---

## 4. Send Invitations (Admin Only)

### Single Invitation
```
Send Nylas invitation to newuser@example.com
```
```
Invite testuser@company.com to connect their email
```
```
Send invitation to john.doe@company.com
```
```
Create an invitation for sarah@company.com
```
```
I need to invite mike@company.com to Nylas
```

### With Additional Details
```
Send invitation to alice@company.com with first name Alice and last name Smith
```
```
Invite bob@company.com (Bob Johnson) to connect
```

### Expected Results
- Success: "I've sent a Nylas invitation to [email]. The invitation includes a secure link to connect their Google or Outlook account. The invitation expires on [date]."
- Shows: invite token, expiration date, OAuth URL
- Rate limit: Max 10 invites/hour per user

---

## 5. Revoke Grant (Admin Only)

### Revoke User Access
```
Revoke Nylas grant for igorh@aidgenomics.com
```
```
Remove Nylas access for testuser@company.com
```
```
Disconnect john.doe@company.com from Nylas
```
```
Revoke grant for sarah@company.com
```
```
I need to remove mike@company.com's Nylas access
```

### Expected Results
- Success: "Successfully revoked Nylas grant for [email]"
- If user not found: "User [email] not found in your company"
- If user has no grant: "User [email] does not have an active grant to revoke"

---

## 6. Permission Testing (Non-Admin Users)

If you want to test permission denials, create a non-admin user and try:

### Should FAIL for Non-Admins
```
List all company grants
```
→ Expected: "Only administrators can list company grants"

```
Send invitation to someone@example.com
```
→ Expected: "Only administrators can send Nylas invitations"

```
Revoke grant for user@example.com
```
→ Expected: "Only administrators can revoke grants"

```
Check grant status for otherperson@company.com
```
→ Expected: "Only administrators can check grant status for other users"

### Should WORK for Non-Admins
```
Check my Nylas grant status
```
→ Expected: Shows their own grant status (always allowed)

---

## 7. Edge Cases and Error Scenarios

### Invalid Email Formats
```
Check grant status for notanemail
```
→ Expected: Error about invalid email format

```
Send invitation to invalid-email
```
→ Expected: Error about invalid email format

### User Not Found
```
Check grant status for nonexistent@example.com
```
→ Expected: "User nonexistent@example.com not found in your company"

```
Revoke grant for doesnotexist@company.com
```
→ Expected: "User doesnotexist@company.com not found in your company"

### Duplicate Invitation
```
Send invitation to igorh@aidgenomics.com
```
(Run twice in a row)
→ Expected: Second attempt may warn about existing pending invitation

### Rate Limiting
Send 11 invitations rapidly
→ Expected: 11th invitation blocked with "Rate limit exceeded: max 10 invites/hour"

---

## 8. Natural Language Variations

The AI should understand these natural variations:

### Grant Status Checks
```
Hey, can you check if igorh@aidgenomics.com has access to Nylas?
```
```
I'm wondering if john@company.com is set up with email integration
```
```
Is alice@company.com's grant active?
```

### List Grants
```
Can you show me everyone who has email access?
```
```
I need to see all the Nylas connections
```
```
Who in our company can use the email features?
```

### Send Invitations
```
I need to get mike@company.com connected to Nylas
```
```
Can you set up sarah@company.com with email access?
```
```
Let's invite bob@company.com to connect his email
```

### Revoke Access
```
I need to disconnect john@company.com
```
```
Can you remove Sarah's Nylas access?
```
```
Disable email integration for mike@company.com
```

---

## 9. Complex Workflows

### Onboarding New User
```
Check grant status for newuser@company.com
```
→ AI: "User does not have grant. Would you like to send invitation?"
```
Yes, send them an invitation
```
→ AI: Sends invitation with OAuth link
```
(User completes OAuth flow)
```
```
Check grant status for newuser@company.com again
```
→ AI: "User has active grant via Google"

### Offboarding User
```
List all company grants
```
→ AI: Shows all users including leaving-user@company.com
```
Revoke grant for leaving-user@company.com
```
→ AI: "Successfully revoked grant"
```
List all company grants again
```
→ AI: Should no longer show leaving-user@company.com

### Troubleshooting User Access
```
Check grant status for problem-user@company.com
```
→ AI: Shows grant details or suggests invitation
```
List all company grants
```
→ AI: Verify user appears in list
```
If needed: Revoke grant for problem-user@company.com, then send new invitation
```

---

## 10. Testing Checklist

Use this checklist to verify all functionality:

### Basic Operations
- [ ] Check own grant status
- [ ] Check another user's grant status (as Admin)
- [ ] List all company grants
- [ ] Send invitation to new email
- [ ] Revoke an active grant

### Permission System
- [ ] Non-admin can check own grant status
- [ ] Non-admin CANNOT check other's grant status
- [ ] Non-admin CANNOT list company grants
- [ ] Non-admin CANNOT send invitations
- [ ] Non-admin CANNOT revoke grants
- [ ] Admin can perform all operations

### Error Handling
- [ ] Invalid email format rejected
- [ ] Nonexistent user handled gracefully
- [ ] Rate limiting enforced (10 invites/hour)
- [ ] Duplicate invitation handling
- [ ] Clear error messages displayed

### AI Understanding
- [ ] Natural language variations understood
- [ ] AI suggests invitation when no grant found
- [ ] AI uses correct action for each request
- [ ] AI provides helpful context in responses

### Integration
- [ ] Backend actions execute successfully
- [ ] Database updates persist
- [ ] Email invitations sent (via V3 microservice)
- [ ] OAuth flow completes and creates grant
- [ ] Grafana logs show action executions

---

## 11. Quick Test Script

Run this sequence for fast verification:

```bash
1. "Check my grant status"
2. "List all company grants"
3. "Check grant status for igorh@aidgenomics.com"
4. "Send invitation to testuser@example.com"
5. "List all company grants again"
6. "Check grant status for testuser@example.com"
7. "Revoke grant for igorh@aidgenomics.com"
8. "List all company grants one more time"
```

Expected: All 8 commands execute successfully with appropriate responses.

---

## 12. Monitoring

### Check Grafana Dashboard
**URL:** http://localhost:3002

**Look for:**
- Action execution logs: `[TOOL_EXECUTION] nylasCheckGrantStatus`
- Service calls: `[grants-service] Getting grant for user...`
- Success/failure rates for each action

### Check Backend Logs
```bash
tail -f /tmp/claude/tasks/bfc5718.output | grep -E "grant|invite|NYLAS"
```

**Expected patterns:**
```
[grants-service] Getting grant for user...
[grants-service] Stored grant for user...
[invite] Created invite for...
[invitations-service] Sent invitation to...
```

---

## 13. Common Issues and Solutions

### Issue: "I don't have access" response
**Cause:** Assistant doesn't have grant actions in allowedActions
**Solution:** Run `node scripts/verify-assistant-update.js`

### Issue: Permission denied for admin operations
**Cause:** User role is not "Admin"
**Solution:** Update user role to "Admin" in database

### Issue: Actions not appearing in UI
**Cause:** Browser cache
**Solution:** Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Email invitations not sending
**Cause:** V3 microservice not running
**Solution:** Check V3 service health, verify EMAIL_* env vars

### Issue: Grant not found after OAuth
**Cause:** Callback handler not creating grant
**Solution:** Check `/api/integrations/nylas/auth/callback` logs

---

## Success Criteria

✅ All test phrases execute without errors
✅ AI selects correct action for each query
✅ Permission system enforces admin-only operations
✅ Natural language variations understood
✅ Error messages are clear and helpful
✅ Database updates persist correctly
✅ Grafana shows successful action executions
✅ User experience is smooth and intuitive

---

**Happy Testing! 🎉**

If you encounter issues, refer to:
- `/docs/GRANT_MANAGEMENT_IMPLEMENTATION.md` (comprehensive guide)
- `/IMPLEMENTATION_COMPLETE.md` (status and troubleshooting)
- Plan file: `/Users/igor/.claude/plans/sleepy-baking-mccarthy.md`
