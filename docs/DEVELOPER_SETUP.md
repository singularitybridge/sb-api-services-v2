# 👨‍💻 Developer Setup Guide

## 🎯 Goal

Set up your local development environment to use **your own user credentials** instead of someone else's.

---

## 📋 Prerequisites

- Access to MongoDB Atlas database
- Your user account created in the database
- Node.js 21+ installed
- npm installed

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Copy Environment Template

```bash
cp .env.example .env
```

**Important:** `.env` is in `.gitignore` - it's YOUR personal config, not shared!

### Step 2: Configure MongoDB Connection

Edit `.env` and update:

```bash
# Shared MongoDB Atlas (all developers use same database)
MONGODB_URI=mongodb+srv://agent-hub-dev:otTwxmXKpNZQFvi8@cluster0.jyenttn.mongodb.net/avi-dev?retryWrites=true&w=majority&appName=Cluster0

# Other required fields (copy from .env.example)
PORT=3000
NODE_ENV=development
JWT_SECRET=YTMyMmY5YWItNDc3ZC00MzQzLTlhNDgtMDE3YzA2YjNhYjM4
ENCRYPTION_KEY=aba46488f21a92b4bd431ae74aadd8b76d73eb55b88052a43f52b807474cc8e6
```

### Step 3: Generate YOUR Test Token

```bash
# Replace with YOUR email from the database
node get-my-token.js your.email@company.com
```

**Example:**
```bash
node get-my-token.js rian@titans.global
```

**Output:**
```
✅ Test Token Generated

👤 User: Hodaya Hodaya
📧 Email: rian@titans.global
🏢 Company: Screen Bites
🆔 User ID: 690b0fdd455d30f7a1c0fdd5
🆔 Company ID: 691215cf455d30f7a1c14291

🔑 Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

📋 Usage:
export TEST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/api/assistants
```

### Step 4: Use Your Token

**Option A: Export for terminal session**
```bash
export TEST_TOKEN="your_token_here"
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/api/assistants
```

**Option B: Use in test scripts**
Create a personal test script:
```javascript
// my-test.js
const myEmail = 'your.email@company.com'; // ← YOUR EMAIL

// Use get-my-token.js to generate token
// Then test your endpoints
```

### Step 5: Start Development

```bash
# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Server runs on: `http://localhost:3000`

---

## 🔐 Authentication Options

### Option 1: Google OAuth (Recommended for Portal)

**Agent Portal:** http://localhost:5173

1. Click "Sign in with Google"
2. Use YOUR Google account
3. System creates session with YOUR user

### Option 2: JWT Token (For API Testing)

**Generate token with your email:**
```bash
node get-my-token.js your.email@company.com
```

**Use in curl:**
```bash
export MY_TOKEN="your_generated_token"
curl -H "Authorization: Bearer $MY_TOKEN" http://localhost:3000/api/integrations
```

### Option 3: Test Scripts

**Create personal test file:**
```javascript
// my-personal-tests.js
const MY_EMAIL = 'your.email@company.com'; // ← CHANGE THIS
const MY_COMPANY = 'Your Company Name';      // ← CHANGE THIS

// Your tests here
```

**Add to `.gitignore`:**
```
my-personal-tests.js
my-*.js
```

---

## 🏢 Multi-Company Setup

### If You Work on Multiple Companies:

**Example: Igor works on both "Aid Genomics" and "Screen Bites"**

**Aid Genomics:**
```bash
node get-my-token.js igorh@aidgenomics.com
```

**Screen Bites:**
```bash
node get-my-token.js igorh@aidgenomics.com  # Same user, different company
```

The system finds the user and generates a token for their company.

---

## 📁 File Organization

### What to Commit:
- ✅ `.env.example` - Template for all developers
- ✅ `get-my-token.js` - Token generator for any user
- ✅ `DEVELOPER_SETUP.md` - This guide

### What NOT to Commit:
- ❌ `.env` - Your personal config (in `.gitignore`)
- ❌ `my-*.js` - Your personal test files
- ❌ JWT tokens in code or comments

---

## 🧪 Testing Your Setup

### 1. Verify Database Connection:
```bash
node get-my-token.js your.email@company.com
```

Should show:
```
✅ Test Token Generated
👤 User: Your Name
🏢 Company: Your Company
```

### 2. Test API with Your Token:
```bash
export TEST_TOKEN="your_token"
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/health
```

Should return:
```json
{"status":"ok","version":"1.2.0"}
```

### 3. Test Agent Portal:
1. Open: http://localhost:5173
2. Sign in with YOUR Google account
3. See YOUR company's assistants

---

## 🚨 Common Issues

### Issue: "User not found with email"

**Solution:**
```bash
# List all available users
node get-my-token.js nonexistent@email.com
```

This shows all users in the database. Find your actual email.

### Issue: "Invalid token"

**Causes:**
1. Token expired (24h validity)
2. JWT_SECRET mismatch between token generation and server
3. Using someone else's token

**Solution:**
```bash
# Generate fresh token
node get-my-token.js your.email@company.com

# Copy new token and export
export TEST_TOKEN="new_token_here"
```

### Issue: "Still seeing Igor's email in Portal"

**Causes:**
1. Browser cached old session
2. Using Google account that doesn't match database user

**Solution:**
1. Clear browser cache/cookies
2. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Sign out and sign in with correct Google account
4. Verify your email exists in database:
   ```bash
   node get-my-token.js your.email@company.com
   ```

### Issue: "No assistants found" in Portal

**Causes:**
1. Your user is in a different company
2. Company has no assistants configured

**Solution:**
```bash
# Check which company you're in
node get-my-token.js your.email@company.com
# Shows your company ID and name

# Check assistants in your company
mongosh "$MONGODB_URI" --eval "
  var user = db.users.findOne({ email: 'your.email@company.com' });
  var assistants = db.assistants.find({ companyId: user.companyId }).toArray();
  print('Your company has', assistants.length, 'assistants');
"
```

---

## 🔄 Working with Multiple Developers

### Team Workflow:

1. **Each developer has their own `.env`:**
   ```
   Igor's .env     → MONGODB_URI=... (Screen Bites focus)
   Rian's .env     → MONGODB_URI=... (same database, different user context)
   Colleague's .env → MONGODB_URI=... (same database, their user)
   ```

2. **Shared database, isolated user contexts:**
   - All developers connect to same MongoDB Atlas
   - Each developer authenticates as themselves
   - Each sees their own company's data (if multi-company)

3. **Testing other users:**
   ```bash
   # Test as yourself
   node get-my-token.js your.email@company.com

   # Test as different user (for debugging)
   node get-my-token.js colleague@company.com
   ```

---

## 📚 Reference Scripts

### `get-my-token.js`
Generates JWT token for any user by email.

**Usage:**
```bash
node get-my-token.js <email>
```

**Example:**
```bash
node get-my-token.js rian@titans.global
```

### `get-screen-bites-token.js` (Deprecated)
Hardcoded to find Screen Bites users. Use `get-my-token.js` instead.

### `get-test-token.js` (Deprecated)
Hardcoded to find `igorh@aidgenomics.com`. Use `get-my-token.js` instead.

---

## 🎯 Best Practices

1. **Never commit `.env` file:**
   - It's in `.gitignore` for a reason
   - Contains your personal database URI, secrets, API keys

2. **Use your own email in tests:**
   ```javascript
   // ❌ DON'T hardcode other people's emails
   const email = 'igorh@aidgenomics.com';

   // ✅ DO use environment variable or prompt
   const email = process.env.MY_EMAIL || process.argv[2];
   ```

3. **Generate fresh tokens daily:**
   - Tokens expire after 24 hours
   - Run `get-my-token.js` each morning

4. **Use Google OAuth in Portal:**
   - More secure than manual tokens
   - Automatic session management
   - No token expiration issues

5. **Document your personal setup:**
   - Create `README-personal.md` (in `.gitignore`)
   - Note which company you're testing
   - Save common commands

---

## 💡 Quick Commands Cheat Sheet

```bash
# Generate YOUR token
node get-my-token.js your.email@company.com

# Start dev server
npm run dev

# Test API health
curl http://localhost:3000/health

# Test with your token
export TEST_TOKEN="your_token"
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/api/integrations

# Open Agent Portal
open http://localhost:5173

# Check your user in database
mongosh "$MONGODB_URI" --eval "db.users.findOne({ email: 'your.email@company.com' })"

# List your company's assistants
mongosh "$MONGODB_URI" --eval "
  var user = db.users.findOne({ email: 'your.email@company.com' });
  db.assistants.find({ companyId: user.companyId }, { name: 1, llmModel: 1 }).forEach(printjson);
"
```

---

## 🆘 Need Help?

1. **Check this guide first** - most issues covered here
2. **Run diagnostic:**
   ```bash
   node get-my-token.js your.email@company.com
   ```
3. **Check database connection:**
   ```bash
   mongosh "$MONGODB_URI" --eval "db.runCommand({ ping: 1 })"
   ```
4. **Ask team:** Someone probably hit the same issue

---

## ✅ Setup Complete!

You should now have:
- ✅ Personal `.env` file (not committed)
- ✅ Ability to generate JWT tokens with YOUR email
- ✅ Dev server running on localhost:3000
- ✅ Agent Portal accessible at localhost:5173
- ✅ Authentication working with YOUR Google account

**Next:** Start developing! 🚀

---

**Last Updated:** 2025-11-27
**Maintained By:** Development Team
