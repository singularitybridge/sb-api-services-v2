# WebSocket Integration Guide

This guide explains how to use the WebSocket functionality for real-time communication between clients and the API service.

## Overview

The WebSocket service provides real-time bidirectional communication, allowing clients to:
- Execute actions in real-time
- Receive immediate updates about action execution status
- Get notifications about system events

The service uses Socket.IO and integrates with the existing authentication system and action framework.

## Connection Details

- **WebSocket Endpoint**: `ws://your-domain/realtime`
- **Authentication**: Uses the same JWT tokens as the REST API
- **Required Parameters**:
  - `token`: JWT token for authentication
  - `sessionId`: Active session ID
- **Optional Parameters**:
  - `artifactId`: Specific artifact ID for targeted updates

## Message Format

### Request Message
```typescript
{
  type: 'REQUEST',
  requestId: string,
  action: string,
  data?: any
}
```

### Response Message
```typescript
{
  type: 'RESPONSE' | 'UPDATE' | 'ERROR',
  requestId: string,
  action?: string,
  data?: any,
  error?: {
    code: string,
    message: string
  }
}
```

## Client Integration Example

### JavaScript/TypeScript
```javascript
import { io } from 'socket.io-client';

const connectWebSocket = (token, sessionId, artifactId) => {
  const socket = io('ws://your-domain', {
    path: '/realtime',
    auth: { token },
    query: { 
      sessionId,
      ...(artifactId && { artifactId })
    }
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });

  // Message handling
  socket.on('message', (message) => {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
    
    switch (parsed.type) {
      case 'RESPONSE':
        console.log('Received response:', parsed);
        break;
      case 'UPDATE':
        console.log('Received update:', parsed);
        break;
      case 'ERROR':
        console.error('Received error:', parsed);
        break;
    }
  });

  // Error handling
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  return socket;
};

// Example: Sending an action request
const sendAction = (socket, action, data) => {
  const message = {
    type: 'REQUEST',
    requestId: Date.now().toString(),
    action,
    data
  };
  
  socket.emit('message', JSON.stringify(message));
};

// Usage example
const socket = connectWebSocket(
  'your-jwt-token',
  'your-session-id',
  'optional-artifact-id'
);

sendAction(socket, 'someAction', { key: 'value' });
```

## Server Integration Example

### Using the WebSocket Service
```typescript
import { getWebSocketService } from '../services/websocket.service';

// Send an update to all clients in a company
const sendCompanyUpdate = (companyId: string, data: any) => {
  const wsService = getWebSocketService();
  if (wsService) {
    wsService.sendUpdate(companyId, {
      type: 'UPDATE',
      requestId: Date.now().toString(),
      action: 'companyUpdate',
      data
    });
  }
};

// Send an update to clients subscribed to a specific artifact
const sendArtifactUpdate = (companyId: string, artifactId: string, data: any) => {
  const wsService = getWebSocketService();
  if (wsService) {
    wsService.sendUpdate(companyId, {
      type: 'UPDATE',
      requestId: Date.now().toString(),
      action: 'artifactUpdate',
      data
    }, artifactId);
  }
};
```

## Authentication and Security

The WebSocket service:
- Requires valid JWT tokens for connection
- Validates tokens on connection and maintains session context
- Enforces company-specific access controls
- Uses the same action permissions as the REST API

## Best Practices

1. **Error Handling**
   - Always handle connection errors and reconnection scenarios
   - Implement exponential backoff for reconnection attempts
   - Validate messages before sending

2. **Message Management**
   - Use unique request IDs for message correlation
   - Keep track of pending requests
   - Implement timeouts for expected responses

3. **Resource Management**
   - Close WebSocket connections when they're no longer needed
   - Handle disconnections gracefully
   - Clean up event listeners when disposing of connections

4. **Security**
   - Never send sensitive data in WebSocket messages
   - Validate all incoming messages
   - Keep JWT tokens secure

## Testing

A test client is available at `tests/websocket/test-client.html` for testing WebSocket functionality. It provides a UI for:
- Connecting with JWT tokens
- Sending test messages
- Viewing responses and updates
- Testing error scenarios

## Troubleshooting

Common issues and solutions:

1. **Connection Failures**
   - Verify JWT token is valid
   - Check if session ID is provided and valid
   - Ensure server is running and accessible

2. **Authentication Errors**
   - Confirm token format is correct
   - Verify token hasn't expired
   - Check company and user permissions

3. **Message Errors**
   - Validate message format
   - Ensure action exists and is allowed
   - Check data format matches expected schema

## Rate Limiting and Quotas

- WebSocket connections are subject to rate limiting
- Message frequency may be throttled
- Consider implementing client-side throttling for busy applications

## Example Use Cases

1. **Real-time Updates**
```typescript
// Client subscribes to updates
socket.on('message', (message) => {
  const parsed = JSON.parse(message);
  if (parsed.type === 'UPDATE' && parsed.action === 'statusChange') {
    updateUI(parsed.data);
  }
});

// Server sends updates
wsService.sendUpdate(companyId, {
  type: 'UPDATE',
  requestId: 'update-1',
  action: 'statusChange',
  data: { status: 'completed' }
});
```

2. **Action Execution**
```typescript
// Client executes action
socket.emit('message', JSON.stringify({
  type: 'REQUEST',
  requestId: 'req-1',
  action: 'processData',
  data: { input: 'value' }
}));

// Client handles response
socket.on('message', (message) => {
  const parsed = JSON.parse(message);
  if (parsed.requestId === 'req-1') {
    handleResponse(parsed);
  }
});
```

## Support

For issues or questions:
- Check the troubleshooting guide
- Review server logs for detailed error messages
- Contact support with relevant connection IDs and timestamps
