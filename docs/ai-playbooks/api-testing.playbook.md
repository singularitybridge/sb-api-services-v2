# API Testing Playbook

This playbook provides a step-by-step guide on how to test an API endpoint using curl. This method is practical and easy to follow, allowing you to quickly verify the functionality of your API services.

## Prerequisites

- Basic understanding of API concepts
- curl installed on your system (most systems have it pre-installed)
- Access to the API you want to test (including any necessary authentication tokens)

## Steps

1. **Identify the API Endpoint**
   - Determine the full URL of the API endpoint you want to test
   - Example: `http://localhost:3000/linear/issues`

2. **Gather Authentication Information**
   - If the API requires authentication, obtain the necessary credentials or tokens
   - Example: Bearer token

3. **Construct the curl Command**
   - Open a terminal or command prompt
   - Use the following template to construct your curl command:

     ```
     curl --location 'API_ENDPOINT_URL' \
     --header 'Authorization: Bearer YOUR_AUTH_TOKEN'
     ```

   - Replace `API_ENDPOINT_URL` with your actual endpoint URL
   - Replace `YOUR_AUTH_TOKEN` with your actual authentication token

4. **Execute the curl Command**
   - Run the constructed curl command in your terminal
   - Example:

     ```
     curl --location 'http://localhost:3000/linear/issues' \
     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
     ```

5. **Analyze the Response**
   - Examine the output returned by the curl command
   - Check if the response is in the expected format (e.g., JSON)
   - Verify that the response contains the expected data

6. **Interpret the Results**
   - If you receive the expected data, the API is functioning correctly
   - If you receive an error or unexpected data, further investigation may be needed

7. **Document the Results**
   - Record the outcome of the test, including:
     - The endpoint tested
     - The curl command used
     - A summary of the response received
     - Any issues or anomalies observed

## Example

Here's an example of testing a Linear API endpoint to fetch issues:

1. **Endpoint**: `http://localhost:3000/linear/issues`

2. **curl Command**:
   ```
   curl --location 'http://localhost:3000/linear/issues' \
   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   ```

3. **Response**: 
   ```json
   [
     {
       "id": "766a8d06-96b4-40b2-b1c0-3bb29d8ca01d",
       "title": "Issues Installing Payload CMS with Executor Agent",
       "description": "I was trying to install Payload CMS and was not able to complete this task with the executor agent...",
       "createdAt": "2024-09-20T14:19:46.871Z",
       ...
     },
     ...
   ]
   ```

4. **Interpretation**: The API successfully returned a list of Linear issues, confirming that the endpoint is working as expected.

## Best Practices

- Always use a test environment when possible to avoid affecting production data
- Be cautious with write operations (POST, PUT, DELETE) as they can modify or remove data
- For complex APIs, consider using tools like Postman for more advanced testing capabilities
- Regularly test your APIs to ensure continued functionality, especially after updates or changes to the system

By following this playbook, you can efficiently test and verify the functionality of your API endpoints using curl.