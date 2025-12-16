# 🎥 Complete Nylas Integration Test Script - All 20 Actions

## ✅ Pre-Recording Setup

**System Status:**
- Backend: http://localhost:8080 ✅
- User: iamagentshimi@gmail.com (Admin) ✅
- Assistant: Nylas Test Assistant (20 actions) ✅
- Database: singularitybridge_dev ✅

**Before Recording:**
- [ ] Refresh browser (Cmd+Shift+R)
- [ ] Select "Nylas Test Assistant"
- [ ] Ensure you have an active Nylas grant
- [ ] Start screen recording

---

# PART 1: EMAIL OPERATIONS (3 Actions)

## 📧 1.1 Get Emails (List)

### Test 1.1.1: Get Recent Emails
```
Get my recent emails
```

**Expected:**
- AI executes `nylasGetEmails`
- Shows list of recent emails with: sender, subject, date, snippet

### Test 1.1.2: Get Emails with Filters
```
Show me emails from the last 7 days
```

**Expected:**
- Filtered email list by date range

### Test 1.1.3: Search Emails
```
Find emails from igorh@aidgenomics.com
```

**Expected:**
- Filtered emails from specific sender

### Natural Language Variations:
```
Show me my inbox
```
```
What emails did I receive today?
```
```
List my unread emails
```
```
Show me emails about "grant management"
```

---

## 📧 1.2 Get Single Email

### Test 1.2.1: Get Specific Email
```
Show me the details of email with ID [email-id]
```

**Expected:**
- AI executes `nylasGetEmail`
- Shows full email details: headers, body, attachments

### Natural Language Variations:
```
Read email [email-id]
```
```
Show me the full content of email [email-id]
```
```
Get email details for [email-id]
```

---

## 📧 1.3 Send Email

### Test 1.3.1: Send Simple Email
```
Send an email to test@example.com with subject "Test Email" and body "This is a test message"
```

**Expected:**
- AI executes `nylasSendEmail`
- Confirmation: email sent successfully
- Shows message ID

### Test 1.3.2: Send Email with CC/BCC
```
Send email to john@example.com, CC sarah@example.com, subject "Team Update", body "Meeting at 3pm"
```

**Expected:**
- Email sent with CC recipient

### Natural Language Variations:
```
Email igorh@aidgenomics.com about the grant system update
```
```
Send a message to test@example.com saying hello
```
```
Compose an email to team@company.com with subject "Weekly Update"
```

---

# PART 2: CALENDAR OPERATIONS (9 Actions)

## 📅 2.1 Get Calendar Events

### Test 2.1.1: Get Upcoming Events
```
Show me my calendar events for today
```

**Expected:**
- AI executes `nylasGetCalendarEvents`
- Lists today's events with time, title, participants

### Test 2.1.2: Get Events for Date Range
```
What meetings do I have this week?
```

**Expected:**
- Events for current week

### Natural Language Variations:
```
Show my schedule for tomorrow
```
```
What's on my calendar for next Monday?
```
```
List all my meetings this month
```
```
Do I have any appointments today?
```

---

## 📅 2.2 Create Calendar Event

### Test 2.2.1: Create Simple Event
```
Create a meeting called "Team Standup" tomorrow at 10am for 1 hour
```

**Expected:**
- AI executes `nylasCreateCalendarEvent`
- Event created successfully
- Returns event ID

### Test 2.2.2: Create Event with Participants
```
Schedule a meeting "Project Review" on Friday at 2pm with igorh@aidgenomics.com and test@example.com
```

**Expected:**
- Event created with participants
- Calendar invites sent

### Test 2.2.3: Create All-Day Event
```
Create an all-day event "Company Holiday" on December 25th
```

**Expected:**
- All-day event created

### Natural Language Variations:
```
Book a meeting tomorrow at 3pm called "Design Review"
```
```
Add "Lunch with Client" to my calendar for Thursday at noon
```
```
Schedule a 30-minute call with team next Monday at 9am
```

---

## 📅 2.3 Get Single Event

### Test 2.3.1: Get Event Details
```
Show me details for calendar event [event-id]
```

**Expected:**
- AI executes `nylasGetEvent`
- Full event details: time, location, participants, description

### Natural Language Variations:
```
Get event information for [event-id]
```
```
Show me the meeting details for [event-id]
```

---

## 📅 2.4 Update Calendar Event

### Test 2.4.1: Update Event Time
```
Update event [event-id] to start at 3pm instead
```

**Expected:**
- AI executes `nylasUpdateEvent`
- Event time updated
- Participants notified

### Test 2.4.2: Update Event Title
```
Change the title of event [event-id] to "Urgent: Project Deadline"
```

**Expected:**
- Event title updated

### Test 2.4.3: Add Participants
```
Add sarah@example.com to event [event-id]
```

**Expected:**
- Participant added to event

### Natural Language Variations:
```
Reschedule event [event-id] to tomorrow
```
```
Move meeting [event-id] to 4pm
```
```
Update event [event-id] description to include Zoom link
```

---

## 📅 2.5 Delete Calendar Event

### Test 2.5.1: Delete Event
```
Delete calendar event [event-id]
```

**Expected:**
- AI executes `nylasDeleteEvent`
- Event deleted
- Cancellation notices sent

### Test 2.5.2: Cancel Meeting
```
Cancel my meeting [event-id] and notify participants
```

**Expected:**
- Event cancelled with notifications

### Natural Language Variations:
```
Remove event [event-id] from my calendar
```
```
Cancel the meeting [event-id]
```

---

## 📅 2.6 Find Available Slots

### Test 2.6.1: Find Availability for Meeting
```
Find available time slots for a 1-hour meeting this week
```

**Expected:**
- AI executes `nylasFindAvailableSlots`
- Returns list of available time slots

### Test 2.6.2: Find Availability with Multiple Participants
```
When are igorh@aidgenomics.com and I both free for a 30-minute meeting tomorrow?
```

**Expected:**
- Available slots considering all participants

### Natural Language Variations:
```
Show me when I'm free for a meeting today
```
```
Find time slots for a 2-hour workshop next week
```
```
When can I schedule a call with the team?
```

---

## 📅 2.7 Get Free/Busy Information

### Test 2.7.1: Check Free/Busy
```
Check free/busy status for igorh@aidgenomics.com today
```

**Expected:**
- AI executes `nylasGetFreeBusy`
- Shows busy/free time blocks

### Test 2.7.2: Check Multiple People
```
Show free/busy for igorh@aidgenomics.com and test@example.com tomorrow
```

**Expected:**
- Free/busy for all requested participants

### Natural Language Variations:
```
Is igorh@aidgenomics.com available at 2pm today?
```
```
Check availability for team@company.com this afternoon
```

---

## 📅 2.8 Check Event Conflicts

### Test 2.8.1: Check for Conflicts
```
Check if there are any conflicts for a meeting tomorrow at 10am for 1 hour
```

**Expected:**
- AI executes `nylasCheckConflicts`
- Returns conflicts if any exist

### Test 2.8.2: Check Before Creating
```
Before scheduling, check conflicts for Friday at 3pm
```

**Expected:**
- Conflict check performed
- Clear to schedule or conflicts reported

### Natural Language Variations:
```
Will a meeting at 2pm today conflict with my schedule?
```
```
Check if I'm double-booked tomorrow at 11am
```

---

## 📅 2.9 Batch Create Events

### Test 2.9.1: Create Multiple Events
```
Create recurring daily standup meetings at 9am for the next 5 days
```

**Expected:**
- AI executes `nylasBatchCreateEvents`
- Multiple events created at once

### Test 2.9.2: Create Event Series
```
Schedule weekly team meetings every Monday at 2pm for the next 4 weeks
```

**Expected:**
- Batch creation of recurring events

### Natural Language Variations:
```
Create a series of training sessions
```
```
Add multiple meetings to my calendar
```

---

## 📅 2.10 Move Event

### Test 2.10.1: Move Event to Different Calendar
```
Move event [event-id] to my work calendar
```

**Expected:**
- AI executes `nylasMoveEvent`
- Event moved to different calendar

### Test 2.10.2: Reschedule Event
```
Move event [event-id] to next week same time
```

**Expected:**
- Event moved to new date/time

### Natural Language Variations:
```
Transfer event [event-id] to another calendar
```
```
Move this meeting to a different day
```

---

# PART 3: CONTACTS OPERATIONS (3 Actions)

## 👥 3.1 Get Contacts

### Test 3.1.1: List All Contacts
```
Show me my contacts
```

**Expected:**
- AI executes `nylasGetContacts`
- Lists contacts with names, emails, phone numbers

### Test 3.1.2: Search Contacts
```
Find contacts with email containing "@aidgenomics.com"
```

**Expected:**
- Filtered contact list

### Test 3.1.3: Get Specific Contact
```
Show me contact information for igorh@aidgenomics.com
```

**Expected:**
- Contact details displayed

### Natural Language Variations:
```
List all my saved contacts
```
```
Show me people in my address book
```
```
Find contact for Igor
```
```
Search for contacts named John
```

---

## 👥 3.2 Create Contact

### Test 3.2.1: Create Simple Contact
```
Create a new contact: John Doe, email john.doe@example.com
```

**Expected:**
- AI executes `nylasCreateContact`
- Contact created successfully
- Returns contact ID

### Test 3.2.2: Create Contact with Full Details
```
Add contact: Sarah Smith, email sarah@company.com, phone +1-555-0123, company "Tech Corp"
```

**Expected:**
- Contact created with all fields

### Test 3.2.3: Create Contact with Multiple Emails
```
Create contact Mike Johnson with emails mike@personal.com and mike@work.com
```

**Expected:**
- Contact with multiple email addresses

### Natural Language Variations:
```
Add a new contact to my address book
```
```
Save contact information for Alice Chen
```
```
Store contact details for new client
```

---

## 👥 3.3 Update Contact

### Test 3.3.1: Update Contact Email
```
Update contact [contact-id] email to newemail@example.com
```

**Expected:**
- AI executes `nylasUpdateContact`
- Contact email updated

### Test 3.3.2: Update Contact Phone
```
Change phone number for contact [contact-id] to +1-555-9999
```

**Expected:**
- Phone number updated

### Test 3.3.3: Add Notes to Contact
```
Add notes to contact [contact-id]: "Met at conference 2024"
```

**Expected:**
- Contact notes updated

### Natural Language Variations:
```
Edit contact information for [contact-id]
```
```
Update John's email address
```
```
Change contact details for Sarah
```

---

# PART 4: GRANT MANAGEMENT (4 Actions)

## 🔐 4.1 Check Grant Status

### Test 4.1.1: Check Own Grant
```
Check my Nylas grant status
```

**Expected:**
- AI executes `nylasCheckGrantStatus`
- Shows grant details or "no grant" message

### Test 4.1.2: Check Other User's Grant (Admin)
```
Check grant status for igorh@aidgenomics.com
```

**Expected:**
- Grant status for specified user
- Auto-suggests invitation if no grant

### Natural Language Variations:
```
Do I have a Nylas grant?
```
```
Am I connected to Nylas?
```
```
Is igorh@aidgenomics.com set up with email integration?
```

---

## 🔐 4.2 List Company Grants (Admin Only)

### Test 4.2.1: List All Grants
```
List all company grants
```

**Expected:**
- AI executes `nylasListCompanyGrants`
- Shows all users with active grants

### Natural Language Variations:
```
Show me all users with Nylas access
```
```
Who has email integration enabled?
```
```
List everyone connected to Nylas
```

---

## 🔐 4.3 Send Invitation (Admin Only)

### Test 4.3.1: Send Simple Invitation
```
Send Nylas invitation to newuser@example.com
```

**Expected:**
- AI executes `nylasSendInvitation`
- Invitation sent with OAuth link

### Test 4.3.2: Send Invitation with Name
```
Send invitation to alice@company.com (Alice Smith)
```

**Expected:**
- Invitation sent with personalized details

### Natural Language Variations:
```
Invite john@company.com to connect email
```
```
Send email integration invitation to sarah@example.com
```

---

## 🔐 4.4 Revoke Grant (Admin Only)

### Test 4.4.1: Revoke User Grant
```
Revoke Nylas grant for testuser@example.com
```

**Expected:**
- AI executes `nylasRevokeGrant`
- Grant revoked successfully

### Natural Language Variations:
```
Remove Nylas access for user@example.com
```
```
Disconnect john@company.com from Nylas
```

---

# 📊 COMPLETE TEST SEQUENCE (20 Actions)

## Quick Test Flow (Copy & Paste)

### EMAIL (3)
```
1. Show me my recent emails
```
```
2. Get email details for [email-id]
```
```
3. Send email to test@example.com with subject "Test" and message "Hello"
```

### CALENDAR (9)
```
4. Show my calendar for today
```
```
5. Create a meeting "Test Meeting" tomorrow at 2pm for 1 hour
```
```
6. Show me details for event [event-id]
```
```
7. Update event [event-id] to start at 3pm
```
```
8. Delete event [event-id]
```
```
9. Find available time slots for a meeting tomorrow
```
```
10. Check free/busy for igorh@aidgenomics.com today
```
```
11. Check if there are conflicts for a meeting tomorrow at 10am
```
```
12. Create daily standup meetings at 9am for the next 3 days
```
```
13. Move event [event-id] to next week
```

### CONTACTS (3)
```
14. Show me my contacts
```
```
15. Create contact: Test User, email testuser@example.com
```
```
16. Update contact [contact-id] phone to +1-555-0000
```

### GRANTS (4)
```
17. Check my Nylas grant status
```
```
18. Check grant status for igorh@aidgenomics.com
```
```
19. List all company grants
```
```
20. Send Nylas invitation to screentest@example.com
```

---

# 🎬 RECORDING STRUCTURE

## Introduction (30 seconds)
**Say:** "Complete Nylas Integration Demo - All 20 Actions"
- Show assistant with 20 actions listed
- Scroll through action names

## Part 1: Email Operations (2 minutes)
- Get emails
- Get single email
- Send email
- Natural language variations

## Part 2: Calendar Operations (4 minutes)
- Get events
- Create event
- Update event
- Delete event
- Availability checks
- Conflict detection
- Batch operations

## Part 3: Contacts (1.5 minutes)
- List contacts
- Create contact
- Update contact

## Part 4: Grant Management (2 minutes)
- Check status
- List grants
- Send invitation
- Natural language understanding

## Conclusion (30 seconds)
**Say:** "All 20 Nylas actions working perfectly!"
- Scroll through successful chat history

**Total Time:** ~10 minutes

---

# ✅ VERIFICATION CHECKLIST

After recording, verify you demonstrated:

### Email Operations
- [ ] ✅ Get emails (list)
- [ ] ✅ Get single email
- [ ] ✅ Send email

### Calendar Operations
- [ ] ✅ Get calendar events
- [ ] ✅ Create event
- [ ] ✅ Get single event
- [ ] ✅ Update event
- [ ] ✅ Delete event
- [ ] ✅ Find available slots
- [ ] ✅ Get free/busy
- [ ] ✅ Check conflicts
- [ ] ✅ Batch create events
- [ ] ✅ Move event

### Contact Operations
- [ ] ✅ Get contacts
- [ ] ✅ Create contact
- [ ] ✅ Update contact

### Grant Management
- [ ] ✅ Check grant status
- [ ] ✅ List company grants
- [ ] ✅ Send invitation
- [ ] ✅ Revoke grant

### General
- [ ] ✅ Natural language variations work
- [ ] ✅ All actions execute successfully
- [ ] ✅ Clear, helpful AI responses
- [ ] ✅ No errors displayed

---

# 🔧 TROUBLESHOOTING

### If Email Actions Don't Work:
- Verify you have an active Nylas grant
- Run: `Check my Nylas grant status`
- If no grant, run: `Send Nylas invitation to [your-email]`

### If Calendar Actions Don't Work:
- Check calendar permissions in Nylas grant
- Verify calendar ID is correct
- Test with simpler queries first

### If Contacts Don't Work:
- Verify contacts permission in grant
- Try listing contacts first before creating

### If Any Action Fails:
1. Refresh browser (Cmd+Shift+R)
2. Check backend: `curl localhost:8080/health`
3. Verify assistant selected: "Nylas Test Assistant"
4. Check backend logs for errors

---

# 📝 NOTES FOR RECORDING

**Emphasize These Points:**

1. **Comprehensive Integration**
   - 20 total actions covering all Nylas features
   - Email, Calendar, Contacts, Grant Management

2. **Natural Language Understanding**
   - AI interprets variations correctly
   - Conversational queries work

3. **Permission System**
   - Some actions require Admin (grants)
   - Some actions require active grant (email/calendar/contacts)

4. **Intelligent Behavior**
   - Auto-suggestions when appropriate
   - Clear error messages
   - Helpful confirmations

---

**Ready for comprehensive recording! Follow the test sequence above. 🎥**
