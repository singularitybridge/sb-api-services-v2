# QA and Verification Playbook

This playbook outlines the steps for quality assurance and verification of the API services.

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

## Reporting Issues

If any issues are discovered during the QA process:

1. Document the specific endpoint and request details.
2. Describe the expected behavior and the actual result.
3. Provide any error messages or unexpected response data.
4. If possible, suggest potential causes or areas for investigation.

By following this playbook, we can ensure thorough testing and verification of our API services, maintaining high quality and reliability.