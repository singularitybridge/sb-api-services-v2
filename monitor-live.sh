#!/bin/bash

echo "🔍 Monitoring Nylas Microservice - Live Feed"
echo "═══════════════════════════════════════════════════════"
echo "Now test your agents in the portal..."
echo "Press Ctrl+C to stop monitoring"
echo ""

tail -f /tmp/nylas-service.log | grep --line-buffered -E "incoming request|Contacts listed|Emails found|Events listed|completed" | while read line; do
    if echo "$line" | grep -q "incoming request"; then
        # Extract URL from the request
        URL=$(echo "$line" | grep -o '"/[^"]*' | sed 's/"//g')
        TIMESTAMP=$(echo "$line" | grep -o '\[[^]]*' | sed 's/\[//' | sed 's/ UTC.*//')
        echo "📨 [$TIMESTAMP] REQUEST: $URL"
    elif echo "$line" | grep -q "Contacts listed"; then
        COUNT=$(echo "$line" | grep -o 'contactCount: [0-9]*' | grep -o '[0-9]*')
        echo "   ✅ Found $COUNT contacts"
    elif echo "$line" | grep -q "completed"; then
        echo "   ✅ Request completed"
        echo ""
    fi
done
