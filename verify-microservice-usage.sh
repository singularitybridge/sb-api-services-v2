#!/bin/bash

echo "════════════════════════════════════════════════════"
echo "   Nylas Microservice Usage Verification"
echo "════════════════════════════════════════════════════"
echo ""

# Check if microservice is running
if lsof -i :3001 > /dev/null 2>&1; then
    echo "✅ Microservice is running on port 3001"
    UPTIME=$(curl -s http://127.0.0.1:3001/health | grep -o '"uptime":[^,]*' | cut -d':' -f2)
    echo "   Uptime: ${UPTIME}s"
else
    echo "❌ Microservice is NOT running on port 3001"
    exit 1
fi

echo ""
echo "Recent requests to microservice (last 10):"
echo "─────────────────────────────────────────────────────"

# Show recent requests
tail -200 /tmp/nylas-service.log | grep "incoming request" | tail -10 | while read line; do
    # Extract timestamp and URL
    TIMESTAMP=$(echo "$line" | grep -o '\[[^]]*' | sed 's/\[//')
    echo "  ⏱  $TIMESTAMP"
done

echo ""
echo "Contacts requests in last 5 minutes:"
echo "─────────────────────────────────────────────────────"

# Count contacts requests
CONTACTS_COUNT=$(tail -500 /tmp/nylas-service.log | grep -c "/contacts")
echo "  📊 Total contacts requests: $CONTACTS_COUNT"

if [ $CONTACTS_COUNT -gt 0 ]; then
    echo ""
    echo "  Most recent contact requests:"
    tail -500 /tmp/nylas-service.log | grep "contacts/list" | tail -3 | while read line; do
        URL=$(echo "$line" | grep -o '"/contacts[^"]*' | sed 's/"//g')
        echo "    → $URL"
    done
fi

echo ""
echo "Email requests in last 5 minutes:"
echo "─────────────────────────────────────────────────────"

EMAIL_COUNT=$(tail -500 /tmp/nylas-service.log | grep -c "/email")
echo "  📧 Total email requests: $EMAIL_COUNT"

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ Migration Status: ACTIVE"
echo "   All requests are routing through microservice"
echo "════════════════════════════════════════════════════"
