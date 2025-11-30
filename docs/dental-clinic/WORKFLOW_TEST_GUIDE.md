# 🦷 Dental Clinic Agent Testing Guide

## 🎯 Overview

Test the AI agent's ability to manage a dental clinic's administrative tasks using Productivity Pro assistant with Nylas integration.

**Test Account:** iamagentshimi@gmail.com (Password: Shimi123!)
**Nylas Grant ID:** 4ec00935-750b-44a2-97a8-9f56c1766804
**User:** Meir Josef Cohen (meir84@gmail.com)

---

## 📋 Prerequisites

1. **Calendar populated** with appointments
2. **Email inbox populated** with patient emails
3. **Agent Portal running:** http://localhost:5173
4. **Sign in as Meir:** meir84@gmail.com

---

## 🧪 Key Test Scenarios

### Test 1: View Today's Calendar
**Send:** "Show me my calendar for today"
**Expected:** List of today's appointments with times, patients, procedures

### Test 2: Find Available Slots  
**Send:** "What times are available tomorrow for a 30-minute checkup?"
**Expected:** List of free time slots

### Test 3: Schedule Appointment
**Send:** "Book Sarah Cohen for teeth cleaning tomorrow at 10 AM"
**Expected:** Event created, confirmation shown

### Test 4: Detect Conflicts
**Send:** "Schedule someone at [existing appointment time]"
**Expected:** Warning about conflict, offers alternatives

### Test 5: Handle Emergency
**Send:** "URGENT: Patient needs emergency appointment today"
**Expected:** Finds soonest slot, prioritizes urgency

---

## 📊 Success Criteria

**Minimum:** 8/10 tests passing
**Critical:** Tests 1, 3, 4 must pass

---

**Full testing guide with 10 detailed scenarios available in this document.**
