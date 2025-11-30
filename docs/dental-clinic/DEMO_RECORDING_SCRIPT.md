# 🎥 Productivity Pro - Demo Recording Script

## 📋 Pre-Recording Checklist

### Setup Verification (5 minutes before recording)
- [ ] Backend running: `npm run dev` in `sb-api-services-v2`
- [ ] Frontend running: http://localhost:5173 accessible
- [ ] Signed in as: **meir84@gmail.com** (Meir Josef Cohen)
- [ ] "Productivity Pro" assistant selected
- [ ] Fresh chat session (click "New Chat")
- [ ] Gmail accessible: https://mail.google.com (iamagentshimi@gmail.com)
- [ ] Google Calendar accessible: https://calendar.google.com (iamagentshimi@gmail.com)

### Recording Tools
- [ ] Screen recording software ready (QuickTime, OBS, Loom, etc.)
- [ ] Audio input tested (clear microphone)
- [ ] Browser zoom at 100% for clarity
- [ ] Notifications disabled
- [ ] Close unnecessary tabs/windows

---

## 🎬 Demo Script (10-12 minutes)

### Part 1: Introduction & Context Setup (2 minutes)

**[Screen: Agent Portal - Productivity Pro assistant]**

**Narration:**
> "Today I'm demonstrating Productivity Pro, an AI assistant powered by Nylas integration that manages email and calendar operations for a dental clinic. This is Dr. Shimi's dental clinic in Tel Aviv. The assistant has access to real patient data, appointment history, and email correspondence."

**Action 1: Check Current Date**
```
YOU: "What's today's date and time?"
```

**Expected Response:**
> "Today is [current day of week], [current date], [current year], at [current time]."
> Example: "Today is Wednesday, November 27, 2025, at 6:50 PM."

✅ **Verification Point:** Agent knows the correct current date (dynamically generated)

---

### Part 2: Calendar Management (3 minutes)

**[Show calendar operations]**

**Action 2: View Today's Schedule**
```
YOU: "Show me today's appointments"
```

**Expected Response:**
- List of appointments for today (current date)
- Patient names, times, procedure types
- Example: "Deborah Kaplan - Extraction at 8:30 AM"

✅ **Verification Point:** Agent retrieves current day's appointments from Nylas

**Action 3: Check Tomorrow's Schedule**
```
YOU: "What appointments do I have tomorrow?"
```

**Expected Response:**
- List of tomorrow's appointments (current date + 1 day)
- Shows agent can query different dates

✅ **Verification Point:** Date-relative queries work correctly

**Action 4: Find Available Time Slot**
```
YOU: "Find me a free 30-minute slot tomorrow afternoon between 2 PM and 5 PM"
```

**Expected Response:**
- Checks calendar for conflicts
- Suggests available time slots
- Example: "Available slots: 2:30 PM, 3:00 PM, 4:00 PM"

✅ **Verification Point:** Agent can find available slots intelligently

---

### Part 3: Email Management (3 minutes)

**[Switch to email operations]**

**Action 5: Check Inbox**
```
YOU: "Check my inbox for recent patient emails"
```

**Expected Response:**
- Lists recent emails (10 most recent)
- Shows patient names and subjects
- Example: "Sarah Cohen - Appointment Request - Teeth Cleaning"
- Example: "David Levi - URGENT: Severe Toothache"

✅ **Verification Point:** Agent can read emails from Nylas

**Action 6: Identify Urgent Requests**
```
YOU: "Are there any urgent or emergency requests in my inbox?"
```

**Expected Response:**
- Identifies emails with "URGENT" or emergency keywords
- Example: "Yes, David Levi has a severe toothache emergency"
- Summarizes the urgent issue

✅ **Verification Point:** Agent can analyze and prioritize emails

---

### Part 4: Integrated Workflow (3 minutes)

**[Demonstrate email + calendar integration]**

**Action 7: Handle Appointment Request from Email**
```
YOU: "Sarah Cohen requested a teeth cleaning appointment. Find her a slot next week and schedule it."
```

**Expected Response:**
- Acknowledges request from Sarah Cohen's email
- Checks calendar for next week availability
- Suggests available slots
- Asks for confirmation before booking

**Follow-up:**
```
YOU: "Yes, book the first available slot"
```

**Expected Response:**
- Creates calendar event
- Includes patient details (Sarah Cohen)
- Sets appropriate duration (30 min for cleaning)
- Confirms appointment created with date/time

✅ **Verification Point:** Agent can connect email context with calendar actions

**Action 8: Verify Booking**
```
YOU: "Confirm Sarah Cohen's appointment was created"
```

**Expected Response:**
- Shows appointment details
- Date, time, duration, patient name

✅ **Verification Point:** Changes are persisted to Nylas

**[Optional: Open Google Calendar in another tab to show the appointment was actually created]**

---

### Part 5: Patient History Context (2 minutes)

**[Show knowledge of patient data we generated]**

**Action 9: Patient History Query**
```
YOU: "Tell me about Michael Katz's recent treatments"
```

**Expected Response:**
- References appointment history
- Mentions root canal series (consultation, treatment, follow-up)
- Shows understanding of ongoing treatment plans

✅ **Verification Point:** Agent has access to historical calendar data

**Action 10: Proactive Scheduling**
```
YOU: "Which patients are overdue for their 6-month checkup?"
```

**Expected Response:**
- Analyzes calendar history
- Identifies patients whose last checkup was >6 months ago
- Example: "Jacob Miller - last checkup June 20, 2024"

✅ **Verification Point:** Agent can analyze patterns in calendar data

---

### Part 6: Error Handling & Edge Cases (1 minute)

**Action 11: Conflict Detection**
```
YOU: "Schedule a new patient consultation tomorrow at 10:00 AM"
```

**Expected Response:**
- Checks calendar for 10:00 AM tomorrow
- If occupied: "That time is already booked with [patient name]"
- Suggests alternative times

✅ **Verification Point:** Agent prevents double-booking

---

### Closing: Summary (1 minute)

**[Show capabilities recap]**

**Action 12: Ask for Summary**
```
YOU: "Summarize what we accomplished in this session"
```

**Expected Response:**
- Lists actions taken
- Shows awareness of context throughout conversation

**Narration:**
> "Productivity Pro successfully demonstrated:
> - Real-time calendar access and management
> - Email inbox monitoring and analysis
> - Intelligent scheduling with conflict detection
> - Integration between email requests and calendar actions
> - Patient history awareness
> - Current date/time awareness
>
> All operations are powered by Nylas API integration with Google Calendar and Gmail."

---

## 🎯 Key Success Metrics

### Must-Pass Criteria:
- ✅ Agent knows current date (not October 2023)
- ✅ Can retrieve today's appointments
- ✅ Can read patient emails
- ✅ Can find available time slots
- ✅ Can create new calendar events
- ✅ Detects scheduling conflicts
- ✅ Maintains context across conversation

### Bonus Points:
- 🌟 Responds within 3-5 seconds per query
- 🌟 Provides specific patient names/times
- 🌟 Natural conversational flow
- 🌟 No errors or API failures

---

## 📊 Verification Steps After Recording

### Backend Verification:
```bash
# Check backend logs for Nylas API calls
tail -f backend.log | grep "NYLAS DEBUG"
```

**Look for:**
- `[NYLAS DEBUG] getCalendarEvents returned: X events`
- `[NYLAS DEBUG] Event created: [event-id]`
- No error messages

### Gmail Verification:
1. Open https://mail.google.com
2. Sign in: iamagentshimi@gmail.com / Shimi123!
3. Verify 10-15 patient emails are visible
4. Check subjects match demo (Sarah Cohen, David Levi, etc.)

### Calendar Verification:
1. Open https://calendar.google.com
2. Sign in: iamagentshimi@gmail.com / Shimi123!
3. Check today's date and tomorrow for appointments
4. Verify Sarah Cohen appointment was created (if demo included scheduling)

---

## 🐛 Troubleshooting Common Issues

### Issue: Agent shows wrong dates
**Solution:** Start a NEW chat session to pick up updated prompt

### Issue: "No appointments found"
**Solution:** Check if calendar data was generated:
```bash
node setup-dental-test-data-quick.js
```

### Issue: "Cannot access inbox"
**Solution:** Verify Nylas credentials in .env:
```bash
grep NYLAS .env
```

### Issue: Agent not responding
**Solution:** Check backend logs for errors:
```bash
tail -f backend.log
```

---

## 📤 Sharing the Recording

### Export Format Recommendations:
- **Video:** MP4, 1920x1080, 30fps
- **Audio:** 192kbps or higher
- **Length:** 10-12 minutes
- **File size:** <500MB for easy sharing

### Upload Destinations:
- **Internal Review:** Google Drive, Dropbox
- **Stakeholder Demo:** Loom, Vimeo (unlisted)
- **Documentation:** Add to repo as `docs/demo-video.mp4`

### Include with Recording:
- [ ] This demo script (DEMO_RECORDING_SCRIPT.md)
- [ ] Setup documentation (DENTAL_ADMIN_SETUP_COMPLETE.md)
- [ ] Test results checklist (WORKFLOW_TEST_GUIDE.md)

---

## 💡 Advanced Demo Variations

### Short Version (5 minutes):
- Part 1: Introduction (1 min)
- Part 2: Calendar - Actions 2, 4 (2 min)
- Part 3: Email - Action 5 (1 min)
- Part 4: Integration - Action 7 (1 min)

### Technical Deep Dive (15 minutes):
- Include all actions above
- Show browser DevTools Network tab (Nylas API calls)
- Show backend logs during operations
- Demonstrate error recovery

### Stakeholder Version (8 minutes):
- Focus on business value
- Skip technical details
- Emphasize time savings and accuracy
- Show before/after workflow comparison

---

**Status:** ✅ Ready for Recording
**Last Updated:** 2025-11-27
**Agent Version:** Productivity Pro (gpt-4o-mini)
**Environment:** Local Development
**Date Handling:** Dynamic (functional approach using system time)

🎬 **Good luck with your recording!**
