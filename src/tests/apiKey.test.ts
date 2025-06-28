import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../index';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { ApiKey } from '../models/ApiKey';
import jwt from 'jsonwebtoken';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('API Key Management', () => {
  let testUser: any;
  let testCompany: any;
  let authToken: string;
  let apiKey: string;

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Company.deleteMany({});
    await ApiKey.deleteMany({});

    // Create test company
    testCompany = await Company.create({
      name: 'Test Company',
      description: 'Test company for API key tests',
      api_keys: [],
      onboardingStatus: 'created',
    });

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      googleId: 'test-google-id',
      companyId: testCompany._id,
      role: 'CompanyUser',
    });

    // Generate JWT token
    authToken = jwt.sign(
      {
        userId: testUser._id,
        email: testUser.email,
        companyId: testCompany._id,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1d' },
    );
  });

  describe('POST /api/keys', () => {
    it('should create a new API key', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          permissions: ['read', 'write'],
          expiresInDays: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe(
        'API key created successfully. Please save this key securely as it will not be shown again.',
      );
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey.name).toBe('Test API Key');
      expect(response.body.apiKey.key).toMatch(/^sk_live_/);
      expect(response.body.apiKey.permissions).toEqual(['read', 'write']);

      // Save the key for later tests
      apiKey = response.body.apiKey.key;
    });

    it('should fail without authentication', async () => {
      const response = await request(app).post('/api/keys').send({
        name: 'Test API Key',
      });

      expect(response.status).toBe(401);
    });

    it('should fail without a name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('API key name is required');
    });
  });

  describe('GET /api/keys', () => {
    beforeEach(async () => {
      // Create some test API keys
      const { key: key1, hashedKey: hashedKey1 } = (
        ApiKey as any
      ).generateApiKey();
      const { key: key2, hashedKey: hashedKey2 } = (
        ApiKey as any
      ).generateApiKey();

      await ApiKey.create([
        {
          name: 'Key 1',
          key: key1,
          hashedKey: hashedKey1,
          userId: testUser._id,
          companyId: testCompany._id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          name: 'Key 2',
          key: key2,
          hashedKey: hashedKey2,
          userId: testUser._id,
          companyId: testCompany._id,
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      ]);
    });

    it('should list all API keys for the user', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.apiKeys).toHaveLength(2);
      expect(response.body.apiKeys[0].name).toBe('Key 1');
      expect(response.body.apiKeys[1].name).toBe('Key 2');
      // Keys should not be returned in list
      expect(response.body.apiKeys[0].key).toBeUndefined();
      expect(response.body.apiKeys[1].key).toBeUndefined();
    });
  });

  describe('DELETE /api/keys/:keyId', () => {
    let apiKeyId: string;

    beforeEach(async () => {
      const { key, hashedKey } = (ApiKey as any).generateApiKey();
      const apiKeyDoc = await ApiKey.create({
        name: 'Key to Delete',
        key,
        hashedKey,
        userId: testUser._id,
        companyId: testCompany._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      });
      apiKeyId = apiKeyDoc._id.toString();
    });

    it('should revoke an API key', async () => {
      const response = await request(app)
        .delete(`/api/keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('API key revoked successfully');

      // Verify the key is revoked
      const revokedKey = await ApiKey.findById(apiKeyId);
      expect(revokedKey?.isActive).toBe(false);
    });

    it('should fail if API key not found', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/keys/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('API key not found or access denied');
    });
  });

  describe('API Key Authentication', () => {
    let testApiKey: string;

    beforeEach(async () => {
      // Create an API key
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auth Test Key',
          expiresInDays: 30,
        });

      testApiKey = response.body.apiKey.key;
    });

    it('should authenticate with API key', async () => {
      // Test with a protected endpoint
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(response.status).not.toBe(401);
    });

    it('should fail with invalid API key', async () => {
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', 'Bearer sk_live_invalid_key');

      expect(response.status).toBe(401);
    });

    it('should track last used timestamp', async () => {
      await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${testApiKey}`);

      const hashedKey = (ApiKey as any).hashApiKey(testApiKey);
      const apiKeyDoc = await ApiKey.findOne({ hashedKey });
      expect(apiKeyDoc?.lastUsed).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    let testApiKey: string;

    beforeEach(async () => {
      // Create an API key
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Rate Limit Test Key',
          expiresInDays: 30,
        });

      testApiKey = response.body.apiKey.key;
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/user/profile')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should not rate limit JWT requests', async () => {
      // Make multiple requests with JWT token
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        // Should not have rate limit headers for JWT
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      }
    });
  });
});
