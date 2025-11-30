# 📋 Quick Meeting Checklist

## Before Meeting Starts

### Windows/Tabs to Open (in this order):
1. ✅ **GitHub PR #42** - https://github.com/singularitybridge/sb-api-services-v2/pull/42
2. ✅ **VS Code** - 3 files ready:
   - `src/integrations/nylas/nylas.actions.ts`
   - `src/integrations/nylas/nylas.service.ts`
   - `src/integrations/nylas/translations/en.json`
3. ✅ **Terminal #1** - For testing commands
4. ✅ **Terminal #2** - Dev server running (`npm run dev`)
5. ✅ **CODE_REVIEW_GUIDE.md** - This guide in VS Code or browser

### Commands Ready to Copy/Paste:

**Test Discovery:**
```bash
node test-discovery-api.js
```

**Generate Token:**
```bash
node get-screen-bites-token.js
```

**Check Database:**
```bash
mongosh "$MONGODB_URI" --eval "
db.companies.findOne({ name: 'Screen Bites' }, { name: 1, api_keys: 1 })
"
```

---

## Meeting Flow (30-45 min)

### ⏱️ 0-5 min: Introduction
- [ ] Show PR overview in GitHub
- [ ] Explain scope: 3 files, 1,286 lines, 14 actions
- [ ] Show "Files changed" tab

### ⏱️ 5-10 min: Architecture
- [ ] Draw/show architecture diagram
- [ ] Explain 3-layer pattern: Actions → Service → API
- [ ] Mention it follows existing integration patterns

### ⏱️ 10-30 min: Code Walkthrough

**File 1: nylas.actions.ts (8 min)**
- [ ] Show email actions structure
- [ ] Show calendar actions structure
- [ ] Point out input/output schemas
- [ ] Ask: "Questions on action definitions?"

**File 2: nylas.service.ts (8 min)**
- [ ] Show smart date defaults (line ~100-120)
- [ ] Show error handling patterns
- [ ] Show Nylas API calls
- [ ] Ask: "Is 7 days + 30 days the right default?"

**File 3: translations/en.json (4 min)**
- [ ] Show a few translation examples
- [ ] Explain purpose for UI/Portal
- [ ] Ask: "Are descriptions clear?"

### ⏱️ 30-40 min: Live Demo
- [ ] Run `test-discovery-api.js` → Show 14 actions found
- [ ] Generate token → Show Screen Bites user
- [ ] Check database → Show no Nylas keys yet
- [ ] Explain: "Needs credentials to be functional"

### ⏱️ 40-45 min: Q&A & Next Steps
- [ ] Discuss security concerns
- [ ] Discuss testing strategy
- [ ] Assign action items
- [ ] Set merge timeline

---

## Key Talking Points

### What This PR Adds:
✅ 14 Nylas actions (3 email + 11 calendar)
✅ Smart date defaults for calendar queries
✅ Full error handling and logging
✅ Translation support for UI
✅ Follows existing integration patterns

### What's NOT Included (on purpose):
❌ Webhook support (future PR)
❌ Real-time sync (future PR)
❌ Email sending with attachments (in roadmap)
❌ Calendar event reminders (Nylas handles this)

### Dependencies:
⚠️ Requires company to have:
- `nylas_api_key` in database
- `nylas_grant_id` in database
- Nylas account configured with email/calendar access

---

## Questions You Might Get

**Q: "Why 7 days past + 30 days future?"**
A: Prevents returning ancient calendar events from 2023. Most users care about recent past and upcoming month. Can be made configurable.

**Q: "What if Nylas API is down?"**
A: Service layer catches errors and logs them. AI assistant receives error message and can inform user. No caching yet (could be added).

**Q: "How much does Nylas cost?"**
A: Depends on plan. Free tier: 500 emails/month. Paid starts at $12/mo. We should track API usage per company.

**Q: "Can we test this without Nylas account?"**
A: Actions are discoverable but won't execute without credentials. Need Nylas sandbox or test account.

**Q: "What about security?"**
A: API keys stored encrypted in MongoDB. JWT required for all endpoints. Follows same pattern as Jira/Twilio.

**Q: "Why not use Gmail API directly?"**
A: Nylas provides unified API for Gmail, Outlook, Exchange, iCloud. One integration = multiple email providers.

**Q: "What about rate limiting?"**
A: Not implemented yet. Nylas has their own rate limits (varies by plan). We should add our own layer.

---

## After Meeting

### Send to Team:
- [ ] Link to CODE_REVIEW_GUIDE.md
- [ ] Meeting recording (if recorded)
- [ ] Action items with owners and due dates
- [ ] Timeline for merge and deployment

### Follow-up Tasks:
- [ ] Address any code feedback
- [ ] Add unit tests (if requested)
- [ ] Create admin setup guide
- [ ] Add monitoring/alerting
- [ ] Test in staging environment

---

## Emergency Contacts

**If demo fails:**
- Dev server not starting? → Check port 3000: `lsof -ti:3000 | xargs kill -9`
- Token invalid? → Regenerate: `node get-screen-bites-token.js`
- Discovery failing? → Check build: `npm run build`

**Screen sharing tips:**
- Hide sensitive .env in VS Code
- Zoom in VS Code: Cmd/Ctrl + Plus
- Use VS Code presentation mode (hides file tree)
- Terminal: Increase font size for visibility

