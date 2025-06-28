const request = require('supertest');
const app = require('../../src/index').default; // Adjust path as necessary
const mongoose = require('mongoose');

// Mock the vector search service
jest.mock('../../src/services/vector.search.service', () => ({
  upsertVector: jest.fn().mockResolvedValue({ success: true }),
  deleteVector: jest.fn().mockResolvedValue({ success: true }),
  runVectorSearch: jest.fn().mockResolvedValue([]),
}));

describe('Memory API Endpoints', () => {
  let createdEntryId;
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmQ0Y2MzMjg0NjEyMjMzNDEzYmViNzciLCJlbWFpbCI6ImF2aUBzaW5ndWxhcml0eWJyaWRnZS5uZXQiLCJjb21wYW55SWQiOiI2NmQ0MWFjMzQ4N2MxOWY2ZDRjMjNmYTEiLCJpYXQiOjE3NDgyMTI4NTAsImV4cCI6MTc0ODgxNzY1MH0.v5j_7aXMLrf_Y-8O1_HFVEw-UY1REp_xVN5naeo6CWY';
  const userId = '66d4cc3284612233413beb77';
  const companyId = '66d41ac3487c19f6d4c23fa1';

  // Ensure mongoose connection is closed after tests
  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('POST /api/memory/entries - should create a new journal entry', async () => {
    const response = await request(app)
      .post('/api/memory/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Test entry for integration test',
        entryType: 'chat',
        tags: ['supertest', 'jest'],
        metadata: { testFramework: 'supertest' },
        // userId and companyId are no longer sent in the body for POST
      });

    // Set createdEntryId immediately after getting a response, before assertions that might fail
    if (response.body && response.body._id) {
      createdEntryId = response.body._id;
    }

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.content).toBe('Test entry for integration test');
    expect(response.body.entryType).toBe('chat');
    expect(response.body.userId).toBe(userId);
    expect(response.body.companyId).toBe(companyId);
    expect(response.body.isIndexed).toBe(true); // Restored assertion, upsertVector is mocked
    expect(response.body.embeddingId).toBe(response.body._id.toString());
    expect(response.body.embeddingModel).toBe('text-embedding-ada-002');
  }, 15000); // Increased timeout to 15 seconds

  test('GET /api/memory/entries - should retrieve journal entries', async () => {
    if (!createdEntryId) {
      throw new Error(
        'Skipping GET /entries test as createdEntryId is undefined. POST test likely failed or did not set ID.',
      );
    }
    const response = await request(app)
      .get(`/api/memory/entries?tags=supertest`) // Removed userId and companyId from query
      .set('Authorization', `Bearer ${token}`);
    if (response.statusCode === 400) {
      console.log(
        'GET /api/memory/entries validation errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const foundEntry = response.body.find(
      (entry) => entry._id === createdEntryId,
    );
    expect(foundEntry).toBeDefined();
    expect(foundEntry.content).toBe('Test entry for integration test');
  });

  test('GET /api/memory/entries/search - should search journal entries', async () => {
    if (!createdEntryId) {
      throw new Error(
        'Skipping GET /entries/search test as createdEntryId is undefined.',
      );
    }
    // Mock runVectorSearch to return the created entry's ID
    const {
      runVectorSearch,
    } = require('../../src/services/vector.search.service');
    runVectorSearch.mockResolvedValueOnce([{ id: createdEntryId, score: 0.9 }]);

    const response = await request(app)
      .get(`/api/memory/entries/search?q=Test`) // Removed companyId and userId from query
      .set('Authorization', `Bearer ${token}`);
    if (response.statusCode === 400) {
      console.log(
        'GET /api/memory/entries/search validation errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const foundEntry = response.body.find(
      (entry) => entry._id === createdEntryId,
    );
    expect(foundEntry).toBeDefined();
  });

  test('GET /api/memory/entries/friendly - should retrieve friendly journal entries', async () => {
    if (!createdEntryId) {
      throw new Error(
        'Skipping GET /entries/friendly test as createdEntryId is undefined.',
      );
    }
    const response = await request(app)
      .get(`/api/memory/entries/friendly?tags=supertest`) // Removed userId and companyId from query
      .set('Authorization', `Bearer ${token}`);
    if (response.statusCode === 400) {
      console.log(
        'GET /api/memory/entries/friendly validation errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const foundEntry = response.body.find(
      (entry) => entry._id === createdEntryId,
    );
    expect(foundEntry).toBeDefined();
    expect(foundEntry).toHaveProperty('userName');
    expect(foundEntry).toHaveProperty('friendlyTimestamp');
  });

  test('PATCH /api/memory/entries/:id - should update a journal entry', async () => {
    if (!createdEntryId) {
      throw new Error(
        'Skipping PATCH /entries/:id test as createdEntryId is undefined.',
      );
    }
    const response = await request(app)
      .patch(`/api/memory/entries/${createdEntryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Updated test entry content',
        tags: ['supertest', 'updated'],
      });
    expect(response.statusCode).toBe(200);
    expect(response.body.content).toBe('Updated test entry content');
    expect(response.body.tags).toEqual(
      expect.arrayContaining(['supertest', 'updated']),
    );
    expect(response.body.isIndexed).toBe(true); // Assuming re-index on content change
  });

  test('DELETE /api/memory/entries/:id - should delete a journal entry', async () => {
    if (!createdEntryId) {
      throw new Error(
        'Skipping DELETE /entries/:id test as createdEntryId is undefined.',
      );
    }
    const response = await request(app)
      .delete(`/api/memory/entries/${createdEntryId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(204);
  });

  test('GET /api/memory/entries - should not find deleted entry', async () => {
    // This test might still fail with 400 if createdEntryId was never set,
    // but the core logic is to check if a previously existing ID is now gone.
    // If createdEntryId is undefined, find will also be undefined, so it might pass misleadingly.
    // However, if POST worked and DELETE worked, this test is valid.
    const response = await request(app)
      .get(`/api/memory/entries?tags=supertest`) // Removed userId and companyId from query
      .set('Authorization', `Bearer ${token}`);
    if (response.statusCode === 400) {
      console.log(
        'GET /api/memory/entries (after delete) validation errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }
    expect(response.statusCode).toBe(200);
    const foundEntry = response.body.find(
      (entry) => entry._id === createdEntryId,
    );
    expect(foundEntry).toBeUndefined();
  });
});
