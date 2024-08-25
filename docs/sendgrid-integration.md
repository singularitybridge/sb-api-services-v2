# SendGrid Integration

This document outlines the integration of SendGrid API into our project, allowing AI agents/assistants to send emails to the currently logged-in user.

## Overview

The SendGrid integration provides the ability to send emails using the SendGrid API. It includes a service for handling email sending, actions for integration with the existing action system, and a new route for SendGrid operations.

## Components

1. **SendGrid Service** (src/services/sendgrid.service.ts)
   - Handles the core functionality of sending emails using the SendGrid API.
   - Retrieves the SendGrid API key from the company API key store.
   - Provides error handling and logging for email sending operations.

2. **SendGrid Actions** (src/actions/sendgridActions.ts)
   - Integrates with the existing action system.
   - Provides a `sendEmail` action that can be used by AI agents/assistants.

3. **SendGrid Routes** (src/routes/sendgrid.routes.ts)
   - Exposes an API endpoint for sending emails.
   - Handles input validation and error responses.

## Usage

### Sending an Email

To send an email, use the `sendEmail` action or make a POST request to the `/sendgrid/send` endpoint with the following parameters:

```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "html": "<p>Email content in HTML format</p>"
}
```

### API Endpoint

- **URL**: `/sendgrid/send`
- **Method**: POST
- **Auth Required**: Yes (JWT Token)
- **Permissions**: Requires company-specific access

### Action Usage

The `sendEmail` action can be used in AI agent/assistant workflows. Example usage:

```javascript
const result = await executeFunctionCall({
  function: {
    name: 'sendEmail',
    arguments: JSON.stringify({
      to: 'user@example.com',
      subject: 'AI Assistant Update',
      html: '<p>Here is an update from your AI assistant.</p>'
    })
  }
}, sessionId, companyId);
```

## Configuration

1. Ensure that the SendGrid API key is added to the company API key store with the key 'sendgrid'.
2. The sender email address is set to 'agent@singularitybridge.net' in the SendGrid service. Update this if a different sender address is required.

## Security Considerations

- The SendGrid API key is securely stored and accessed using the existing company API key store.
- All endpoints require authentication and company-specific access.
- Input validation is performed on all email parameters to prevent injection attacks.
- Rate limiting should be implemented to prevent abuse of the email sending functionality.

## Testing

Unit tests for the SendGrid service are available in `src/services/__tests__/sendgrid.service.test.ts`. Run these tests to ensure the functionality is working as expected.

## Error Handling

The SendGrid service and routes include error handling for common scenarios such as:
- Missing or invalid API key
- Invalid email parameters
- SendGrid API errors

Errors are logged for debugging purposes and appropriate error responses are sent to the client.

## Future Improvements

- Implement email templates for common use cases.
- Add support for email attachments.
- Implement a queue system for handling large volumes of emails.
- Add more comprehensive logging and monitoring for email sending activities.