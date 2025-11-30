# Calendar Genius - Agentic Calendar Planner Guide

## Overview

Calendar Genius is an AI-powered scheduling assistant that uses the Nylas API to provide intelligent calendar management with advanced agentic capabilities. It goes beyond simple CRUD operations to offer smart scheduling, conflict resolution, and batch planning.

---

## Key Features

### 1. **Intelligent Slot Finding**
- Automatically finds optimal meeting times
- Ranks slots based on:
  - Time of day (morning priority)
  - Spacing from other meetings
  - Day of week (mid-week preferred)
  - Participant availability
- Returns top 10 options with quality scores

### 2. **Conflict Detection & Resolution**
- Detects scheduling conflicts before creating events
- Suggests alternative times when conflicts are found
- Considers participant availability

### 3. **Batch Scheduling**
- Create multiple events in one operation
- Perfect for recurring meetings
- Handles failures gracefully

### 4. **Natural Language Understanding**
- Parses casual scheduling requests
- Understands relative time ("next week", "tomorrow morning")
- Auto-detects meeting duration from context

### 5. **Proactive Optimization**
- Suggests better meeting times
- Recommends calendar improvements
- Maintains buffer time between meetings

---

## Available Actions

### Basic Calendar Operations

#### `nylasGetCalendarEvents`
Retrieve upcoming calendar events.

**Parameters:**
- `limit` (number, optional): Max events to return (default: 20)
- `start` (number, optional): Unix timestamp for start of range
- `end` (number, optional): Unix timestamp for end of range

**Example:**
```
"Show me my events for today"
```

#### `nylasCreateCalendarEvent`
Create a new calendar event.

**Parameters:**
- `title` (string, required): Event title
- `description` (string, optional): Event description
- `startTime` (string, required): ISO 8601 format (e.g., "2024-01-15T10:00:00Z")
- `endTime` (string, required): ISO 8601 format
- `participants` (string, optional): Comma-separated emails
- `location` (string, optional): Event location

**Example:**
```
"Create a meeting called 'Project Review' tomorrow at 2 PM for 1 hour with john@example.com"
```

---

### Advanced Calendar Management

#### `nylasGetEvent`
Get detailed information about a specific event.

**Parameters:**
- `eventId` (string, required): The event ID

**Example:**
```
"Get details for event abc123"
```

#### `nylasUpdateEvent`
Update an existing event (move, reschedule, or modify).

**Parameters:**
- `eventId` (string, required): Event to update
- `title`, `description`, `location` (string, optional): Updated fields
- `startTime`, `endTime` (string, optional): New times
- `participants` (string, optional): Updated attendee list

**Example:**
```
"Change the title of event abc123 to 'Team Sync'"
"Move event abc123 to start at 3 PM tomorrow"
```

#### `nylasDeleteEvent`
Permanently delete a calendar event.

**Parameters:**
- `eventId` (string, required): Event to delete

**Example:**
```
"Delete my 5 PM meeting"
```

---

### Smart Scheduling Actions

#### `nylasFindAvailableSlots`
Intelligently find available time slots for a meeting. Returns ranked slots based on optimal scheduling.

**Parameters:**
- `durationMinutes` (number, required): Meeting length
- `dateRangeStart` (string, required): Search start date (ISO 8601)
- `dateRangeEnd` (string, required): Search end date (ISO 8601)
- `preferredTimeStart` (string, optional): Preferred start time of day (default: "09:00")
- `preferredTimeEnd` (string, optional): Preferred end time of day (default: "17:00")
- `participants` (string, optional): Emails to check availability
- `bufferMinutes` (number, optional): Buffer between meetings (default: 15)

**Returns:**
Array of available slots with:
- `startTime`, `endTime`: ISO strings
- `score`: Quality rating (0-100)
- `reason`: Human-readable explanation

**Example:**
```
"Find time for a 30-minute meeting with sarah@example.com next week"
```

**Response Format:**
```json
[
  {
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T09:30:00Z",
    "score": 90,
    "reason": "Excellent slot: optimal morning time, mid-week"
  },
  {
    "startTime": "2024-01-16T10:00:00Z",
    "endTime": "2024-01-16T10:30:00Z",
    "score": 85,
    "reason": "Excellent slot: optimal morning time, mid-week"
  }
]
```

#### `nylasGetFreeBusy`
Check availability for participants during a time range.

**Parameters:**
- `emails` (string, required): Comma-separated email addresses
- `startTime` (string, required): Range start (ISO 8601)
- `endTime` (string, required): Range end (ISO 8601)

**Example:**
```
"Is john@example.com available tomorrow afternoon?"
```

#### `nylasCheckConflicts`
Check if a proposed time conflicts with existing events. Suggests alternatives if conflicts found.

**Parameters:**
- `startTime` (string, required): Proposed start time
- `endTime` (string, required): Proposed end time
- `participants` (string, optional): Attendees to check

**Returns:**
- `hasConflict`: boolean
- `conflicts`: Array of conflicting events
- `alternatives`: Array of suggested alternative slots

**Example:**
```
"Can I schedule a meeting tomorrow at 2 PM?"
```

#### `nylasMoveEvent`
Move an event to a new time with automatic conflict checking.

**Parameters:**
- `eventId` (string, required): Event to move
- `newStartTime` (string, required): New start time (ISO 8601)
- `newEndTime` (string, required): New end time (ISO 8601)
- `checkConflicts` (boolean, optional): Validate before moving (default: true)

**Example:**
```
"Move my 3 PM meeting to 4 PM"
```

---

### Batch Operations

#### `nylasBatchCreateEvents`
Create multiple events in one operation. Perfect for recurring meetings.

**Parameters:**
- `events` (string, required): JSON array of event objects

Each event object should have:
- `title` (required)
- `startTime`, `endTime` (required)
- `description`, `location`, `participants` (optional)

**Example Request:**
```json
{
  "events": "[
    {
      \"title\": \"Daily Standup\",
      \"startTime\": \"2024-01-15T09:00:00Z\",
      \"endTime\": \"2024-01-15T09:15:00Z\",
      \"participants\": [\"team@example.com\"]
    },
    {
      \"title\": \"Daily Standup\",
      \"startTime\": \"2024-01-16T09:00:00Z\",
      \"endTime\": \"2024-01-16T09:15:00Z\",
      \"participants\": [\"team@example.com\"]
    }
  ]"
}
```

**Example Natural Language:**
```
"Schedule daily standups at 9 AM for the next two weeks with the team"
```

---

## Usage Examples

### Example 1: Finding Time for a Meeting

**User:** "Find time for a 1-hour meeting with john@example.com and sarah@example.com next week"

**Agent Workflow:**
1. Extracts: duration=60 min, participants, date range = next week
2. Calls `nylasFindAvailableSlots` with:
   - `durationMinutes`: 60
   - `dateRangeStart`: "2024-01-15T00:00:00Z"
   - `dateRangeEnd`: "2024-01-19T23:59:59Z"
   - `participants`: "john@example.com,sarah@example.com"
3. Receives ranked slots
4. Presents top 3 options to user
5. Waits for user selection
6. Creates event with `nylasCreateCalendarEvent`

---

### Example 2: Moving a Conflicting Meeting

**User:** "Move my 3 PM meeting tomorrow - it conflicts with another call"

**Agent Workflow:**
1. Retrieves events for tomorrow
2. Identifies 3 PM event
3. Uses `nylasCheckConflicts` to validate conflict
4. Calls `nylasFindAvailableSlots` for alternatives
5. Presents options: "How about 2 PM or 4 PM instead?"
6. User selects 4 PM
7. Uses `nylasMoveEvent` to reschedule
8. Confirms: "Moved 'Project Review' to 4 PM tomorrow"

---

### Example 3: Batch Scheduling Recurring Meetings

**User:** "Schedule my weekly 1-on-1s with team members every Monday at 2 PM for the next month"

**Agent Workflow:**
1. Identifies: recurring pattern, weekly, Monday, 2 PM, 1 month
2. Calculates dates: All Mondays in next 30 days
3. Gets team member emails from context/calendar
4. For each team member:
   - Builds event array with correct dates
5. Uses `nylasBatchCreateEvents` to create all at once
6. Reports: "Created 12 meetings (4 weeks × 3 team members)"

---

## Scoring Algorithm

The slot ranking algorithm uses these factors:

### Time of Day (max +30 points)
- **9 AM - 12 PM**: +30 (Morning prime time)
- **1 PM - 3 PM**: +20 (Early afternoon)
- **3 PM - 5 PM**: +10 (Late afternoon)

### Meeting Spacing (max +20 points)
- **60+ min gap**: +20 (Excellent spacing)
- **30+ min gap**: +10 (Good spacing)
- **< 30 min gap**: +0 (Tight schedule)

### Day of Week (max +10 points)
- **Mon-Thu**: +10 (Peak productivity days)
- **Friday**: +5 (Still workable)
- **Weekend**: +0 (Avoid unless specified)

**Total Score Range:** 0-100

**Score Interpretation:**
- **80-100**: Excellent - Optimal time, good spacing, mid-week
- **60-79**: Good - Acceptable time with minor trade-offs
- **40-59**: Available - Suboptimal but workable
- **0-39**: Poor - Outside preferred hours or tight spacing

---

## Natural Language Patterns

The agent understands these phrases:

### Time References
- "next week" → Monday-Friday of upcoming week
- "tomorrow morning" → Next day, 9 AM - 12 PM
- "this afternoon" → Today, 1 PM - 5 PM
- "end of day" → 4 PM - 6 PM
- "later today" → Current time + 2 hours

### Duration Detection
- "quick chat" → 15 minutes
- "call" / "meeting" → 30 minutes (default)
- "1-on-1" → 30 minutes
- "workshop" / "review" → 60 minutes
- "half day" → 4 hours

### Action Verbs
- "find time" → Use `nylasFindAvailableSlots`
- "schedule" / "create" → `nylasCreateCalendarEvent`
- "move" / "reschedule" → `nylasMoveEvent`
- "cancel" / "delete" → `nylasDeleteEvent`
- "check if" → `nylasCheckConflicts`

---

## Configuration

### Required API Keys
Ensure these are configured in company settings:
- `nylas_api_key`: Nylas API key
- `nylas_grant_id`: Nylas Grant ID (connected account)

### Model Settings
- **Model**: `gpt-4o` (required for complex reasoning)
- **Temperature**: 0.3 (precise scheduling decisions)
- **Max Tokens**: 2000

---

## Best Practices

### For Users
1. **Be Specific**: "Find time for 30 min with John next week" is better than "Schedule something"
2. **Provide Context**: Mention if meeting is urgent, recurring, or has specific constraints
3. **Confirm Before Batch**: Review batch scheduling details before creating
4. **Trust the AI**: The scoring algorithm considers many factors - top suggestions are usually best

### For Developers
1. **Always Check Conflicts**: Use `nylasCheckConflicts` before critical meetings
2. **Buffer Time**: Default 15-min buffer prevents back-to-back fatigue
3. **Error Handling**: Batch operations report partial successes
4. **Time Zones**: Always use ISO 8601 format with timezone

---

## Troubleshooting

### "No available slots found"
**Cause**: Calendar is fully booked in date range
**Solution**:
- Extend date range
- Reduce meeting duration
- Adjust preferred time window

### "Conflict detected"
**Cause**: Proposed time overlaps with existing event
**Solution**: Agent automatically suggests alternatives

### "Participant not available"
**Cause**: All participants have conflicts
**Solution**: Agent finds mutual availability or suggests reducing participant list

### "Batch creation partial failure"
**Cause**: Some events conflict or have invalid times
**Solution**: Check `failed` array in response for details

---

## Limitations

1. **Nylas Sandbox**: Cannot join WhatsApp groups (production account required)
2. **Free/Busy**: Requires participants to have shared calendar access
3. **Time Zones**: Assumes UTC unless specified
4. **Recurring Rules**: Simple recurrence only (use batch create)
5. **External Calendars**: Only accesses Nylas-connected accounts

---

## API Reference

### Nylas API v3
- Base URL: `https://api.us.nylas.com`
- Authentication: Bearer token
- Documentation: https://developer.nylas.com/docs/v3/

### Action Response Format
All actions return:
```typescript
{
  success: true,
  data: {
    // Action-specific data
  }
}
```

---

## Testing

### Quick Test Scenarios

1. **Find Available Time**
```
"Find time for a 30-minute meeting tomorrow morning"
```

2. **Check Conflicts**
```
"Can I schedule a meeting at 2 PM today?"
```

3. **Create Recurring**
```
"Schedule team standup at 9 AM every weekday next week"
```

4. **Move Meeting**
```
"Move my 3 PM meeting to 4 PM"
```

---

## Support

For issues or questions:
- Check Nylas API status: https://status.nylas.com/
- Review error messages in response
- Verify API keys are configured
- Ensure calendar is connected via Nylas

---

**Version:** 1.0
**Last Updated:** January 2025
**Model Required:** GPT-4o or higher
