# 👥 Multi-Developer Setup - Quick Start

## 🚨 Important for New Developers

**If you're setting up this project for the first time on your machine**, follow these steps to use YOUR credentials instead of someone else's.

---

## ⚡ Quick Setup (2 minutes)

### Step 1: Copy Environment File
```bash
cp .env.example .env
```

**That's it!** The `.env.example` already has all the shared credentials configured.

### Step 2: Generate YOUR Token

**Find your email in the database:**
```bash
# Replace with YOUR actual email
node get-my-token.js your.email@company.com
```

**Examples:**
```bash
# If you're Rian
node get-my-token.js rian@titans.global

# If you're Igor
node get-my-token.js igorh@aidgenomics.com

# If you don't know your email, try any email - script will list all users
node get-my-token.js test@test.com
```

**Output shows:**
- ✅ Your name
- ✅ Your email
- ✅ Your company
- ✅ JWT token for API testing

### Step 3: Start Development

```bash
# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

**Server runs on:** http://localhost:3000
**Agent Portal:** http://localhost:5173

---

## 🔐 Authentication in Agent Portal

### Option 1: Google OAuth (Recommended)

1. Open http://localhost:5173
2. Click "Sign in with Google"
3. Use **YOUR** Google account
4. System authenticates you as YOUR user

**✅ You'll see YOUR company's assistants**
**✅ All actions use YOUR email/context**

### Option 2: API Testing with Token

```bash
# Generate your token
node get-my-token.js your.email@company.com

# Export it
export TEST_TOKEN="your_token_here"

# Test API
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/api/assistants
```

---

## 🏢 Multi-Company Developers

**If you work on multiple companies (e.g., Aid Genomics + Screen Bites):**

Your user account determines which company you're authenticated as:

```bash
# Check which company you're in
node get-my-token.js your.email@company.com
```

Output shows:
```
🏢 Company: Screen Bites (or Aid Genomics, etc.)
```

---

## ❌ Common Issues

### Issue: "Still seeing Igor's email"

**Cause:** Browser cached old session

**Solution:**
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Clear browser cache
3. Sign out and sign in again with YOUR Google account

### Issue: "User not found"

**Cause:** Your email not in database or typo

**Solution:**
```bash
# List all users
node get-my-token.js nonexistent@test.com
```

Shows all available users - find your correct email.

### Issue: "No assistants found"

**Cause:** Your company has no assistants configured

**Solution:**
Ask admin to create assistants for your company, or:
```bash
# Check assistants in your company
mongosh "$MONGODB_URI" --eval "
  var user = db.users.findOne({ email: 'your.email@company.com' });
  db.assistants.find({ companyId: user.companyId }, { name: 1 }).forEach(printjson);
"
```

---

## 📚 Full Documentation

For detailed setup, troubleshooting, and advanced configuration:

**Read:** [DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md)

---

## 🎯 Quick Reference

| Command | Purpose |
|---------|---------|
| `cp .env.example .env` | Create your personal config |
| `node get-my-token.js your.email@company.com` | Generate JWT token |
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server |
| `open http://localhost:5173` | Open Agent Portal |

---

## ✅ Checklist

After setup, you should have:

- [ ] Personal `.env` file (copied from `.env.example`)
- [ ] Your JWT token generated with YOUR email
- [ ] Dev server running on localhost:3000
- [ ] Agent Portal working at localhost:5173
- [ ] Signed in with YOUR Google account
- [ ] Seeing YOUR company's assistants

---

## 🆘 Need Help?

1. **Read full guide:** [DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md)
2. **Check your user exists:**
   ```bash
   node get-my-token.js your.email@company.com
   ```
3. **Verify database connection:**
   ```bash
   mongosh "$MONGODB_URI" --eval "db.runCommand({ ping: 1 })"
   ```
4. **Ask team:** Someone probably hit the same issue!

---

**Last Updated:** 2025-11-27
