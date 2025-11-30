# ⏰ Date & Time Handling - Technical Documentation

## 🎯 Functional Approach (No Hardcoded Timestamps)

The system uses a **fully functional approach** for date and time handling. All timestamps are generated dynamically from system time.

---

## 📋 Implementation Details

### Core Service: `session-context.service.ts`

**Location:** `/src/services/session-context.service.ts`

**How it works:**
```typescript
// Get current date and time DYNAMICALLY
const now = new Date();  // ← System time at execution

const currentDate = now.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
// Example output: "Wednesday, November 27, 2025"

const currentDateTime = now.toLocaleString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
// Example output: "Wednesday, November 27, 2025, 06:50 PM"
```

**Key Points:**
- ✅ **No hardcoded dates** - uses `new Date()`
- ✅ **Always current** - fetched on every session start
- ✅ **Timezone aware** - uses system locale
- ✅ **Human readable** - formatted for natural language

---

## 🔄 Data Flow

```
User starts chat session
        ↓
Session created in database
        ↓
getSessionContextData() called
        ↓
new Date() → Current system time
        ↓
Format: "Wednesday, November 27, 2025"
        ↓
Injected into Handlebars template
        ↓
AI assistant prompt updated with current date
        ↓
Assistant knows today's date
```

---

## 📝 Template Variables Available

When the assistant prompt is processed, these variables are available:

| Variable | Type | Example | Updates |
|----------|------|---------|---------|
| `{{currentDate}}` | String | "Wednesday, November 27, 2025" | Every session |
| `{{currentDateTime}}` | String | "Wednesday, November 27, 2025, 06:50 PM" | Every session |
| `{{user.name}}` | String | "Meir Josef Cohen" | When user changes |
| `{{user.email}}` | String | "meir84@gmail.com" | When user changes |
| `{{company.name}}` | String | "Screen Bites" | When company changes |
| `{{assistant.name}}` | String | "Productivity Pro" | Static |

---

## 🎨 Usage in Assistant Prompts

**Productivity Pro prompt example:**

```markdown
## 📅 CURRENT DATE AND TIME
**Today's date is: {{currentDate}}**
**Current date and time: {{currentDateTime}}**

Use this information when users ask about "today", "tomorrow", "this week", etc.
```

**After template processing (runtime):**

```markdown
## 📅 CURRENT DATE AND TIME
**Today's date is: Wednesday, November 27, 2025**
**Current date and time: Wednesday, November 27, 2025, 06:50 PM**

Use this information when users ask about "today", "tomorrow", "this week", etc.
```

---

## ⚙️ Configuration

### Timezone
**Current:** System default (server timezone)

**To customize timezone:**
```typescript
// In session-context.service.ts
const currentDate = now.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Jerusalem', // ← Add timezone
});
```

### Locale
**Current:** `en-US` (English, United States format)

**To customize locale:**
```typescript
// Change 'en-US' to desired locale
const currentDate = now.toLocaleDateString('he-IL', { // Hebrew, Israel
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
// Output: "יום רביעי, 27 בנובמבר 2025"
```

---

## 🧪 Testing Date Handling

### Manual Test (via chat):
```
User: "What's today's date?"
Expected: "Today is [current day], [current date], [current year]"
```

### Automated Test:
```typescript
// tests/session-context.test.ts
import { getSessionContextData } from '../services/session-context.service';

describe('Date handling', () => {
  it('should return current date dynamically', async () => {
    const context1 = await getSessionContextData(sessionId);
    const now = new Date();
    const expectedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    expect(context1.currentDate).toBe(expectedDate);
  });
});
```

### Test Different Dates:
```bash
# Linux/Mac: Temporarily change system time
sudo date -s "2026-01-15 14:30:00"

# Start backend
npm run dev

# Agent should now think it's January 15, 2026

# Reset to actual time
sudo ntpdate -s time.apple.com
```

---

## 🚀 Production Considerations

### ✅ Advantages of Functional Approach:
1. **Zero maintenance** - no manual date updates needed
2. **Always accurate** - matches server time
3. **Test friendly** - can mock `Date` constructor
4. **Scalable** - works across timezones
5. **Consistent** - same approach everywhere

### ⚠️ Potential Issues:

**Issue 1: Server timezone mismatch**
- **Problem:** Server in UTC, users in Israel (GMT+2)
- **Solution:** Add explicit timezone configuration

**Issue 2: Daylight saving time**
- **Problem:** Date format changes during DST transitions
- **Solution:** Use `Intl.DateTimeFormat` for consistent formatting

**Issue 3: Date calculation errors**
- **Problem:** "Tomorrow" could be wrong if crossing month/year boundary
- **Solution:** Use date-fns library for reliable date math

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `src/services/session-context.service.ts` | **Core date generation** |
| `src/services/template.service.ts` | Handlebars template processing |
| `src/services/assistant/message-handling.service.ts` | Calls session context |
| `src/models/Assistant.ts` | Stores assistant prompts |
| `DEMO_RECORDING_SCRIPT.md` | Demo shows dynamic dates |

---

## 🔧 Debugging Date Issues

### Check what date the assistant sees:
```bash
# In MongoDB
mongosh 'mongodb+srv://...' --eval "
var session = db.sessions.findOne({ _id: ObjectId('SESSION_ID') });
print('Session created:', session.createdAt);
"
```

### Check backend logs:
```bash
tail -f backend.log | grep "System prompt processed"
# The prompt here should show current date
```

### Test in chat:
```
User: "What date do you think it is?"
User: "What's the current timestamp?"
User: "Am I talking to you on November 27, 2025?"
```

---

## 🌍 Multi-timezone Support (Future Enhancement)

**Current limitation:** Uses server timezone only

**Proposed solution:**
```typescript
export const getSessionContextData = async (
  sessionId: string,
  userTimezone?: string, // ← Add parameter
): Promise<SessionContextData> => {
  const user = await User.findById(session.userId);
  const tz = userTimezone || user.timezone || 'UTC';

  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz, // ← Use user's timezone
  });

  // Store timezone in context
  return {
    ...otherFields,
    currentDate,
    currentDateTime,
    timezone: tz,
  };
};
```

**User model enhancement:**
```typescript
interface User {
  name: string;
  email: string;
  timezone?: string; // ← Add field: 'America/New_York', 'Asia/Jerusalem', etc.
}
```

---

## 📊 Performance Impact

**Date generation cost:** Negligible
- `new Date()`: ~0.001ms
- `toLocaleDateString()`: ~0.1ms
- Total per session: <0.2ms

**Caching consideration:** Not needed
- Date changes rarely during a session
- Context fetched once per session start
- Minimal computational overhead

---

## ✅ Best Practices

### ✅ DO:
- Use `new Date()` for current time
- Format dates with `toLocaleDateString()`
- Store user timezone preferences
- Use ISO 8601 for API responses
- Test across timezones

### ❌ DON'T:
- Hardcode dates in prompts
- Assume server timezone = user timezone
- Use string manipulation for date math
- Ignore DST transitions
- Cache date values across sessions

---

**Status:** ✅ Implemented & Production Ready
**Last Updated:** 2025-11-27
**Approach:** Functional (Dynamic)
**Maintenance:** Zero (automatic)

🎯 **The system is future-proof and requires no manual date updates!**
