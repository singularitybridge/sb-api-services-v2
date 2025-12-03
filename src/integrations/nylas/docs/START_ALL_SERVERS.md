# 🚀 Start All Servers After Computer Restart

## Prerequisites Check

### 1. MongoDB
MongoDB needs to be running first.

**Check if MongoDB is running:**
```bash
# On macOS with Homebrew
brew services list | grep mongodb

# Or check process
ps aux | grep mongod
```

**Start MongoDB:**
```bash
# If installed via Homebrew
brew services start mongodb-community

# Or manually
mongod --config /usr/local/etc/mongod.conf
```

---

## Server Startup Sequence

### Terminal 1: Backend API Server

```bash
cd /Users/igor/agent_test_api_mcp/sb-api-services-v2
npm run dev
```

**Expected output:**
```
Server is running on port 3000
Successfully connected to MongoDB database: avi-dev
```

**Backend URL:** http://localhost:3000

---

### Terminal 2: Frontend Server

```bash
cd /Users/igor/agent_test_api_mcp/sb-agent-webapp-vite
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

**Frontend URL:** http://localhost:5173

---

## Quick Startup Script

Create this script to start both servers at once:

```bash
#!/bin/bash

# Check MongoDB
if ! pgrep -x mongod > /dev/null; then
    echo "⚠️  MongoDB not running. Starting..."
    brew services start mongodb-community
    sleep 3
fi

# Start Backend (in background)
echo "🚀 Starting Backend..."
cd /Users/igor/agent_test_api_mcp/sb-api-services-v2
npm run dev &
BACKEND_PID=$!

# Wait for backend
sleep 5

# Start Frontend (in background)
echo "🚀 Starting Frontend..."
cd /Users/igor/agent_test_api_mcp/sb-agent-webapp-vite
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started!"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "📱 Open: http://localhost:5173"
echo ""
echo "To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
```

---

## Verification

Once both servers are running:

1. **Check Backend:** http://localhost:3000/health (should return 200 OK)
2. **Check Frontend:** http://localhost:5173 (should show login page)
3. **Login as:** iamagentshimi@gmail.com
4. **Test agent:** contacts-dev-agent

---

## Troubleshooting

### Port Already in Use

If you see "Port 3000 already in use":
```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)
```

If you see "Port 5173 already in use":
```bash
# Find process using port 5173
lsof -ti:5173

# Kill it
kill -9 $(lsof -ti:5173)
```

### MongoDB Connection Failed

```bash
# Check MongoDB status
brew services list | grep mongodb

# Restart MongoDB
brew services restart mongodb-community

# Check logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

### Environment Variables Missing

If backend says "Missing environment variables":
```bash
cd /Users/igor/agent_test_api_mcp/sb-api-services-v2
cat .env | grep MONGODB_URI
cat .env | grep NYLAS_CLIENT_ID
```

Make sure `.env` file exists with all required variables.

---

## Stop All Servers

```bash
# Kill backend
pkill -f "tsx src/index.ts"

# Kill frontend
pkill -f "vite"

# Or use Ctrl+C in each terminal
```
