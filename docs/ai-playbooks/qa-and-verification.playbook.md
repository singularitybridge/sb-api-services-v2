# QA and Verification Playbook

This playbook outlines the steps for quality assurance and verification of the API services.

## Test Suite Execution

Before proceeding with manual testing, ensure that all automated tests are passing:

1. Run the entire test suite:
   ```
   npm test
   ```
2. Address any failures or errors that occur.
3. If new features or services have been added, ensure that appropriate unit tests have been implemented.

## API Endpoint Testing

To ensure the reliability and correctness of our API endpoints, follow these steps:

1. Obtain an authentication token from the user.
2. Use curl commands to test each API endpoint. Here's a general template:

```bash
curl 'http://localhost:3000/auth/verify-token' \
  -X 'POST' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-US,en;q=0.9,he-IL;q=0.8,he;q=0.7,ru-RU;q=0.6,ru;q=0.5' \
  -H 'Authorization: Bearer USER_PROVIDED_TOKEN' \
  -H 'Connection: keep-alive' \
  -H 'Content-Length: 0' \
  -H 'Origin: http://localhost:5173' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"'
```

Replace USER_PROVIDED_TOKEN with the actual token provided by the user for authentication.

3. Test all CRUD operations for each resource, where applicable.
4. Verify the response status codes and body content for each request.
5. Test edge cases, such as invalid inputs or unauthorized access attempts.
6. Document any unexpected behavior or errors encountered during testing.

## Example Curl Commands

Here are some example curl commands for common endpoints:

1. Get user profile:
```bash
curl 'http://localhost:3000/users/profile' \
  -X 'GET' \
  -H 'Authorization: Bearer USER_PROVIDED_TOKEN'
```

2. Create a new resource:
```bash
curl 'http://localhost:3000/resources' \
  -X 'POST' \
  -H 'Authorization: Bearer USER_PROVIDED_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"name": "New Resource", "description": "This is a test resource"}'
```

3. Update an existing resource:
```bash
curl 'http://localhost:3000/resources/resource_id' \
  -X 'PUT' \
  -H 'Authorization: Bearer USER_PROVIDED_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Updated Resource", "description": "This resource has been updated"}'
```

4. Delete a resource:
```bash
curl 'http://localhost:3000/resources/resource_id' \
  -X 'DELETE' \
  -H 'Authorization: Bearer USER_PROVIDED_TOKEN'
```

Remember to replace USER_PROVIDED_TOKEN with the actual token provided by the user for authentication.

### 3. Verify Action Execution Messages

- **Objective**: Ensure that action execution messages (e.g., "Action started...", "Action completed...") are displayed correctly in the chat UI.
- **Steps**:
    1. Trigger an action that is expected to show execution messages (e.g., "Create a journal entry with title 'Test' and content 'This is a test.'").
    2. Observe the chat UI for the appearance of "Action started..." and "Action completed..." messages.
    3. Verify that the messages accurately reflect the status and details of the action.
    4. **Troubleshooting**: If action execution messages are not appearing or updating, try restarting the development server. This can resolve issues related to stale state or caching.
- **Expected Outcome**: Action execution messages appear and update correctly, providing real-time feedback on the action's progress.

## Documentation Review

As part of the QA process, ensure that all documentation is up-to-date:

1. Review the README.md file for accuracy and completeness.
2. Check that API documentation (e.g., Swagger or OpenAPI specs) is current and reflects any recent changes.
3. Verify that any new features or services are properly documented in the `docs/` directory.
4. Ensure that any changes in behavior or new functionalities are reflected in the documentation.

## Reporting Issues

If any issues are discovered during the QA process:

1. Document the specific endpoint and request details.
2. Describe the expected behavior and the actual result.
3. Provide any error messages or unexpected response data.
4. If possible, suggest potential causes or areas for investigation.
5. Create an issue in the project's issue tracking system (e.g., GitHub Issues) with all relevant information.

## Final Verification

Before considering the QA process complete:

1. Run the entire test suite again to ensure no regressions: `npm test`
2. Perform a final manual check of critical API endpoints.
3. Verify that all documentation is up-to-date and accurately reflects the current state of the API.

By following this playbook, we can ensure thorough testing, verification, and documentation of our API services, maintaining high quality and reliability.
