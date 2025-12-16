# 👨‍💼 Admin Calendar Management - Creating Events in Team Members' Calendars

## ✅ Feature: Already Implemented!

Agent Shimi (as administrator) CAN create events directly in team members' calendars using the `userEmail` parameter.

---

## 🎯 How to Use

### Correct Phrasing

**The AI needs to understand you want to create an event ON a specific user's calendar.**

### ✅ Working Phrases:

```
Create meeting "Daily Standup" for user igorh@aidgenomics.com tomorrow at 11am for 30 minutes
```

```
Create calendar event on igorh@aidgenomics.com's calendar titled "Team Meeting" tomorrow at 2pm for 1 hour
```

```
Schedule "Project Review" on igorh@aidgenomics.com's calendar for Friday at 3pm
```

```
Add event to igorh@aidgenomics.com calendar: "Client Call" next Monday 10am, 45 minutes
```

```
Book "Training Session" for user igorh@aidgenomics.com next Wednesday at 1pm for 2 hours
```

---

## 🔑 Key Parameter: userEmail

The `nylasCreateCalendarEvent` action has this parameter:

```javascript
userEmail: {
  type: 'string',
  description: 'Email of the team member whose calendar to create the event on.
                If not provided, uses company default.'
}
```

**When you specify `for user [email]` or `on [email]'s calendar`, the AI should extract the userEmail parameter.**

---

## 📋 What Happens When You Create an Event

### Step 1: AI Parses Your Request
```
Input: "Create meeting 'Daily Standup' for user igorh@aidgenomics.com tomorrow at 11am"

AI extracts:
  - title: "Daily Standup"
  - userEmail: "igorh@aidgenomics.com"
  - startTime: [tomorrow at 11am in ISO format]
  - endTime: [calculated based on duration or default 1 hour]
```

### Step 2: Grant Resolution
```
System looks up grant for igorh@aidgenomics.com:
  1. Checks NylasGrant collection for Igor's grant
  2. If not found, checks User.nylasGrant (legacy)
  3. If not found, falls back to company default
```

### Step 3: Event Creation via V3 Microservice
```
V2 calls V3 microservice:
  - Uses Igor's grantId
  - Creates event in Igor's calendar
  - Event appears immediately in Igor's Google/Outlook calendar
```

### Step 4: Igor Can See/Edit/Decline
```
Igor's calendar now shows:
  - "Daily Standup" event
  - Created by: Agent Shimi
  - Igor can: Edit, Delete, Accept, Decline
```

---

## 🔄 Current Status: Igor's Grant

**Status:** Igor has a legacy grant with test grantId

```
Grant ID: test-grant-123456 (test value, may not work with real Nylas API)
Email: igorh@aidgenomics.com
Provider: Google
Status: active
Scopes: email, calendar, contacts
```

### ⚠️ Potential Issue

The grantId "test-grant-123456" looks like a placeholder. This might cause:
- ✅ Work if it's a valid test grant in your Nylas account
- ❌ Fail with "Forbidden" if it's not recognized by Nylas API

---

## 🧪 Test Now

### Test 1: Create Event in Igor's Calendar

**Try this in the UI:**
```
Create meeting "Test Admin Event" for user igorh@aidgenomics.com tomorrow at 2pm for 30 minutes
```

**Expected if grant works:**
- ✅ Event created successfully
- ✅ Event ID returned
- ✅ Event visible in Igor's calendar

**Expected if grant doesn't work:**
- ❌ Error: "Forbidden" or "Invalid grant"
- Need to get real grant for Igor

---

## 🔧 If Grant Doesn't Work: Get Real Grant for Igor

### Option 1: Send Igor an Invitation
```
Send Nylas invitation to igorh@aidgenomics.com
```

Then Igor completes OAuth flow:
1. Receives email
2. Clicks OAuth link
3. Authorizes Google Calendar
4. Grant created automatically

### Option 2: Direct OAuth Setup
1. Log in as Igor
2. Complete Nylas OAuth flow
3. Grant created with proper permissions

---

## 📝 Complete Test Sequence

### Test A: Admin Creates Event in Team Member's Calendar
```
1. Create meeting "Standup" for user igorh@aidgenomics.com tomorrow at 9am for 15 minutes
```
**Verify:** Event appears in Igor's calendar

### Test B: Admin Creates Multiple Events
```
2. Schedule "Team Review" on igorh@aidgenomics.com's calendar for Friday at 3pm for 1 hour
```
**Verify:** Both events in Igor's calendar

### Test C: Admin Creates Event with Participants
```
3. Create meeting "Planning Session" for user igorh@aidgenomics.com next Monday at 10am with test@example.com and team@company.com
```
**Verify:** Event created with invites sent to participants

### Test D: Natural Language Variation
```
4. Book a meeting called "Client Call" for Igor tomorrow at 4pm
```
**Verify:** AI correctly identifies userEmail from "for Igor"

---

## 🎯 Key Differences from Regular Event Creation

### ❌ Creating Event in YOUR Calendar (Shimi's) with Invite
```
Create meeting "Standup" tomorrow at 9am with igorh@aidgenomics.com
```
**Result:**
- Event created in **Shimi's calendar**
- Igor receives **calendar invitation**
- Igor must **accept** to add to his calendar

### ✅ Creating Event in IGOR'S Calendar (Admin Function)
```
Create meeting "Standup" for user igorh@aidgenomics.com tomorrow at 9am
```
**Result:**
- Event created in **Igor's calendar** directly
- Igor sees event **immediately** (no acceptance needed)
- Igor can **edit/delete** as needed
- **This is what you want for administrative control**

---

## 🔐 Permission Model

### Who Can Create Events in Other Users' Calendars?

**Currently:** Anyone who knows the syntax can specify `userEmail` parameter

**Best Practice:** Should add admin check:
```javascript
// In nylasCreateCalendarEvent action
if (userEmail && userEmail !== context.userEmail) {
  // Creating event in another user's calendar
  const requestingUser = await User.findById(context.userId);
  if (requestingUser.role !== 'Admin') {
    throw new ActionValidationError(
      'Only administrators can create events in other users\' calendars'
    );
  }
}
```

**Status:** This check is NOT currently implemented, but should be added for security.

---

## 📊 Testing Checklist

Before recording:
- [ ] Verify Igor has a valid Nylas grant (real or test)
- [ ] Test creating event in Igor's calendar
- [ ] Verify event appears in Igor's calendar (check Google Calendar UI)
- [ ] Test natural language variations
- [ ] Test with participants
- [ ] Test error handling if grant invalid

---

## 🎥 Recording Script for Admin Calendar Creation

### Intro (10 seconds)
**Say:** "Demonstrating admin calendar management - creating events in team members' calendars"

### Test 1: Basic Admin Event Creation (30 seconds)
```
Create meeting "Daily Standup" for user igorh@aidgenomics.com tomorrow at 9am for 15 minutes
```
**Show:** Event created, event ID returned

### Test 2: Natural Language Variation (30 seconds)
```
Schedule "Team Review" on Igor's calendar for Friday at 3pm
```
**Show:** AI understands "Igor's calendar" and creates event

### Test 3: Event with Participants (30 seconds)
```
Book "Planning Session" for user igorh@aidgenomics.com next Monday at 10am with test@example.com
```
**Show:** Event created with participants

### Test 4: Verify in Igor's Calendar (30 seconds)
**Show:** Open Google Calendar for igorh@aidgenomics.com
**Point out:** All 3 events appear in Igor's calendar
**Demonstrate:** Igor can edit/delete these events

### Outro (10 seconds)
**Say:** "Admin can create events directly in team members' calendars - full schedule control"

**Total:** ~3 minutes

---

## 🚀 Ready to Test

**Try this NOW in the UI:**

```
Create meeting "Test Admin Calendar" for user igorh@aidgenomics.com tomorrow at 2pm for 30 minutes
```

**If it works:** ✅ You can record the full admin calendar demo

**If it fails:** ⚠️ Igor needs a real Nylas grant - send invitation first

---

**This is the administrative calendar control you wanted! 🎉**
