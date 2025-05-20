import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as ContentService from '../../../src/services/content.service';
import { ContentItem, IContentItem } from '../../../src/models/ContentItem';
import { ContentType } from '../../../src/models/ContentType';
import { Company } from '../../../src/models/Company'; // Import Company model
import * as apiKeyService from '../../../src/services/api.key.service'; // Import to mock

// Mock api.key.service
jest.mock('../../../src/services/api.key.service');
const mockedApiKeyService = apiKeyService as jest.Mocked<typeof apiKeyService>;

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Content Service', () => {
  const mockCompanyId = new mongoose.Types.ObjectId().toString();
  let mockContentTypeId: string;
  const mockArtifactKey = 'testArtifactKey';

  beforeEach(async () => {
    await ContentItem.deleteMany({});
    await ContentType.deleteMany({});
    await Company.deleteMany({}); // Clear companies too

    // Mock getApiKey to return a dummy key, bypassing decryption
    mockedApiKeyService.getApiKey.mockImplementation(async (companyId, keyType) => {
      if (companyId === mockCompanyId && keyType === 'openai_api_key') {
        return 'sk-mockOpenAiApiKey'; // Return a decrypted-like key
      }
      return null;
    });

    // Create a mock company (still needed if other parts of the service use it directly, though getApiKey is now mocked)
    // For safety, keep it, but its api_keys content is less critical now for getApiKey.
    const company = new Company({
      _id: mockCompanyId,
      name: 'Test Company',
      api_keys: [{ // Minimal valid structure if Company model still needs it for save()
          name: 'openai_api_key', 
          key: 'openai_api_key', 
          value: 'dummyValue', 
          iv: '64756d6d7949763132333435', // "dummyIv12345" in hex (12 bytes)
          tag: '64756d6d795461673132333435363738', // "dummyTag12345678" in hex (16 bytes)
          created_at: new Date() 
      }]
    });
    await company.save();


    // Create a mock content type
    const contentType = new ContentType({
      companyId: mockCompanyId,
      name: 'Test Content Type',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'string', required: true },
        { name: 'tags', type: 'array', required: false },
      ],
    });
    await contentType.save();
    mockContentTypeId = contentType._id.toString();
  });

  it('should create a content item', async () => {
    const contentData = {
      title: 'Test Content',
      body: 'This is a test content',
      tags: ['test', 'content'],
    };

    const createdContent = (await ContentService.createContentItem(
      mockCompanyId,
      mockContentTypeId,
      contentData,
      mockArtifactKey
    )) as IContentItem;

    expect(createdContent).toBeDefined();
    expect(createdContent.data.title).toBe(contentData.title);
    expect(createdContent.companyId.toString()).toBe(mockCompanyId);
    expect(createdContent.contentTypeId.toString()).toBe(mockContentTypeId);
  });

  it('should get all content items for a company', async () => {
    const contentData1 = { title: 'Content 1', body: 'Body 1' };
    const contentData2 = { title: 'Content 2', body: 'Body 2' };

    await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData1, mockArtifactKey);
    await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData2, mockArtifactKey);

    const contentItems = await ContentService.getContentItems(mockCompanyId);

    expect(contentItems).toHaveLength(2);
    // Check that items are sorted by createdAt in descending order
    expect(contentItems[0].data.title).toBe(contentData2.title);
    expect(contentItems[1].data.title).toBe(contentData1.title);
  });

  it('should update a content item', async () => {
    const contentData = { title: 'Original Title', body: 'Original body' };
    const createdContent = (await ContentService.createContentItem(
      mockCompanyId,
      mockContentTypeId,
      contentData,
      mockArtifactKey
    )) as IContentItem;

    const updatedData = { title: 'Updated Title', body: 'Updated body' };
    const updatedContent = (await ContentService.updateContentItem(
      createdContent._id.toString(),
      mockCompanyId,
      updatedData,
      mockArtifactKey
    )) as IContentItem;

    expect(updatedContent).toBeDefined();
    expect(updatedContent.data.title).toBe(updatedData.title);
    expect(updatedContent.data.body).toBe(updatedData.body);
  });

  it('should delete a content item', async () => {
    const contentData = { title: 'To be deleted', body: 'This will be deleted' };
    const createdContent = (await ContentService.createContentItem(
      mockCompanyId,
      mockContentTypeId,
      contentData,
      mockArtifactKey
    )) as IContentItem;

    const result = await ContentService.deleteContentItem(createdContent._id.toString(), mockCompanyId);

    expect(result).toBe(true);

    const contentItems = await ContentService.getContentItems(mockCompanyId);
    expect(contentItems).toHaveLength(0);
  });
});
