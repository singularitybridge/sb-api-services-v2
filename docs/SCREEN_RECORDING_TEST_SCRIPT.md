# 🎥 Screen Recording Test Script - Grant Management System

## ✅ Pre-Recording Checklist

Before you start recording, verify:

- [x] Backend running (http://localhost:8080) ✅
- [x] User is Admin (iamagentshimi@gmail.com) ✅
- [x] Assistant has all 4 grant actions ✅
- [ ] Browser refreshed (Cmd+Shift+R or Ctrl+Shift+R)
- [ ] "Nylas Test Assistant" selected in UI
- [ ] Screen recording software ready

---

## 🎬 Recording Script (Follow This Order)

### INTRO (10 seconds)
**Say:** "Testing Nylas Grant Management System - All 4 Actions"

**Show:**
- Browser with "Nylas Test Assistant" selected
- Show the assistant's allowed actions list (scroll to show grant actions)

---

## Part 1: Check Grant Status (Own Account)

### Test 1.1: Check Your Own Grant
**Type in chat:**
```
Check my Nylas grant status
```

**Expected Result:**
- AI should execute `nylasCheckGrantStatus` action
- Response shows either:
  - Grant details (if you have one), OR
  - "You do not have an active Nylas grant"

**Narration:** "First, checking my own grant status - any user can do this"

---

## Part 2: Check Grant Status (Other User)

### Test 2.1: Check Another User's Grant
**Type in chat:**
```
Check grant status for igorh@aidgenomics.com
```

**Expected Result:**
- AI executes `nylasCheckGrantStatus` with userEmail parameter
- Shows grant details OR "User does not have an active grant. Would you like me to send them an invitation?"

**Narration:** "Now checking another user's grant - this requires Admin permissions"

### Test 2.2: Natural Language Variation
**Type in chat:**
```
Is igorh@aidgenomics.com connected to Nylas?
```

**Expected Result:**
- AI understands the variation and checks grant status
- Same action executed as Test 2.1

**Narration:** "The AI understands natural language variations"

---

## Part 3: List Company Grants

### Test 3.1: List All Grants
**Type in chat:**
```
List all company grants
```

**Expected Result:**
- AI executes `nylasListCompanyGrants` action
- Shows list of all users with active grants
- Includes: email, provider, status, creation date

**Narration:** "Listing all grants in the company - Admin-only feature"

### Test 3.2: Natural Language Variation
**Type in chat:**
```
Show me all users with email integration
```

**Expected Result:**
- Same action executed
- List of users displayed

**Narration:** "Again, natural language works perfectly"

---

## Part 4: Send Invitation

### Test 4.1: Send Invitation to New User
**Type in chat:**
```
Send Nylas invitation to screentest@example.com
```

**Expected Result:**
- AI executes `nylasSendInvitation` action
- Response shows:
  - Confirmation email sent
  - Expiration date (7 days from now)
  - OAuth URL included

**Narration:** "Sending an invitation to a new user - Admin-only action"

### Test 4.2: Check Invitation Suggestion
**Type in chat:**
```
Check grant status for screentest@example.com
```

**Expected Result:**
- AI finds no grant
- Suggests: "Would you like me to send them an invitation?"

**Narration:** "When a user has no grant, the AI automatically suggests sending an invitation"

---

## Part 5: Revoke Grant

### Test 5.1: Revoke a Grant (if you have test data)
**Type in chat:**
```
Revoke Nylas grant for testuser@example.com
```

**Expected Result:**
- AI executes `nylasRevokeGrant` action
- Confirmation: "Successfully revoked grant" OR "User not found/has no grant"

**Narration:** "Revoking a grant - Admin-only action for security"

### Test 5.2: Verify Revocation
**Type in chat:**
```
List all company grants
```

**Expected Result:**
- Revoked user should NOT appear in the list (if they had a grant)
- List updates correctly

**Narration:** "Verifying the grant was removed from the company list"

---

## Part 6: Natural Language Understanding

### Test 6.1: Conversational Query
**Type in chat:**
```
Hey, can you check if anyone in our company has Nylas connected?
```

**Expected Result:**
- AI executes `nylasListCompanyGrants`
- Shows list naturally

**Narration:** "The AI handles conversational, natural language queries"

### Test 6.2: Complex Request
**Type in chat:**
```
I need to invite john.test@company.com to connect their email
```

**Expected Result:**
- AI executes `nylasSendInvitation`
- Sends invitation

**Narration:** "Complex requests are understood and executed correctly"

---

## Part 7: Permission System Demo

### Test 7.1: Show Admin Capabilities
**Type in chat:**
```
What grant management actions can I perform?
```

**Expected Result:**
- AI lists available grant management actions
- Mentions Admin-only restrictions

**Narration:** "As an Admin, I have access to all grant management features"

---

## 🎬 OUTRO (10 seconds)

**Say:** "Grant Management System - All Tests Passed ✅"

**Show:**
- Final chat history with all successful tests
- Scroll through the conversation showing all actions executed

---

## 📋 Test Summary Checklist

During/after recording, verify you demonstrated:

- [ ] ✅ Check own grant status
- [ ] ✅ Check other user's grant status
- [ ] ✅ List all company grants
- [ ] ✅ Send invitation
- [ ] ✅ Revoke grant
- [ ] ✅ Natural language understanding (3+ variations)
- [ ] ✅ Auto-suggestion when no grant found
- [ ] ✅ Admin permission system working
- [ ] ✅ All 4 grant management actions executed successfully

---

## 🔧 Quick Commands (Keep This Window Open)

If you need to check anything during recording:

### Verify Backend
```bash
curl http://localhost:8080/health
```

### Check Assistant
```bash
node scripts/verify-assistant-update.js
```

### View Backend Logs
```bash
tail -20 /tmp/claude/tasks/bfc5718.output | grep -E "grant|TOOL_EXECUTION"
```

---

## 🎯 Key Points to Highlight

**While recording, emphasize:**

1. **Natural Language Understanding**
   - AI understands variations: "check", "show", "is connected", etc.
   - Conversational queries work

2. **Permission System**
   - Admins can do everything
   - Regular users can only check their own status
   - Clear error messages for unauthorized actions

3. **Auto-Suggestions**
   - When no grant found, AI suggests sending invitation
   - Helpful, proactive behavior

4. **All 4 Actions Working**
   - nylasCheckGrantStatus ✅
   - nylasListCompanyGrants ✅
   - nylasSendInvitation ✅
   - nylasRevokeGrant ✅

---

## 🚨 Troubleshooting During Recording

If something doesn't work:

1. **Don't panic** - pause recording
2. **Refresh browser** (Cmd+Shift+R)
3. **Check assistant selected** ("Nylas Test Assistant")
4. **Verify backend** running: `curl localhost:8080/health`
5. **Resume recording** and try again

---

## 📊 Expected Recording Length

- **Intro:** 10 seconds
- **Part 1-2:** 1 minute (grant status checks)
- **Part 3:** 30 seconds (list grants)
- **Part 4:** 1 minute (invitations)
- **Part 5:** 30 seconds (revoke)
- **Part 6:** 1 minute (natural language)
- **Part 7:** 30 seconds (permissions)
- **Outro:** 10 seconds

**Total:** ~5 minutes for comprehensive demo

---

**Ready to record! Follow the script above step-by-step. Good luck! 🎥**
