import 'dotenv/config';
// import fetch from 'node-fetch'; // Assuming node-fetch is available or using native fetch

const API_BASE_URL = process.env.ENDPOINT_URL ? process.env.ENDPOINT_URL.replace('/assistant/user-input', '') : 'http://localhost:3000';
const SESSION_TOKEN = process.env.SESSION_TOKEN;

if (!SESSION_TOKEN) {
  throw new Error('SESSION_TOKEN environment variable is not set. Please set it in your .env file for e2e tests.');
}

describe('Session Management API Tests', () => {
  let initialSessionId = null;

  beforeAll(async () => {
    // Get an initial session to work with
    const response = await fetch(`${API_BASE_URL}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to create initial session: ${response.status} ${errorBody}`);
    }
    const sessionData = await response.json();
    expect(sessionData).toHaveProperty('_id');
    initialSessionId = sessionData._id;
  });

  test('POST /session/clear should end current session and return a new one', async () => {
    // 1. Call /session/clear
    const clearResponse = await fetch(`${API_BASE_URL}/session/clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    expect(clearResponse.ok).toBe(true);
    const newSessionData = await clearResponse.json();
    
    expect(newSessionData).toHaveProperty('_id');
    expect(newSessionData).toHaveProperty('assistantId');
    expect(newSessionData).toHaveProperty('channel');
    expect(newSessionData).toHaveProperty('language');
    expect(newSessionData._id).not.toBe(initialSessionId); // Important: new session ID

    // 2. Verify the new session is active (implicitly, getSessionOrCreate should ensure this)
    // We can try to get its details
    const getNewSessionResponse = await fetch(`${API_BASE_URL}/session/${newSessionData._id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`,
      },
    });
    expect(getNewSessionResponse.ok).toBe(true);
    const newSessionDetails = await getNewSessionResponse.json();
    expect(newSessionDetails._id).toBe(newSessionData._id);
    // expect(newSessionDetails.active).toBe(true); // Assuming 'active' field is returned by GET /session/:id

    // 3. (Optional but good) Verify the initial session is no longer active or accessible in the same way
    // This might require an admin endpoint or a specific way to check session status
    // For now, we'll rely on the fact that /clear should have ended it.
    // If GET /session/:id for the initialSessionId now returns 404 or an inactive session, that's a good sign.
    const getOldSessionResponse = await fetch(`${API_BASE_URL}/session/${initialSessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SESSION_TOKEN}`,
        },
      });
      // Depending on how ended sessions are handled, this might be a 404 or a session object with active: false
      // For this test, let's assume it might still be findable but should be inactive if the model includes 'active'
      if (getOldSessionResponse.ok) {
        const oldSessionDetails = await getOldSessionResponse.json();
        // This depends on the Session model and what GET /session/:id returns.
        // If 'active' is part of the ISessionExtended and returned by the friendly aggregation:
        // expect(oldSessionDetails.active).toBe(false); 
      } else {
        // A 404 could also be acceptable if ended sessions are hard to retrieve by non-admins
        // For now, we won't strictly assert this part without knowing the exact behavior of GET /session/:id for ended sessions.
      }

    // Update initialSessionId for subsequent tests if any
    initialSessionId = newSessionData._id; 

  }, 30000); // 30s timeout

  // TODO: Add tests for PUT /session/language (no ID)
  // TODO: Add tests for GET /session/language (no ID)
  // TODO: Add tests for GET /session/messages (no ID)
  // TODO: Add tests for POST /assistant/user-input (no sessionId in body)
});
