import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as ContentService from '../../../src/services/content.service';
import { ContentItem, IContentItem } from '../../../src/models/ContentItem';
import { ContentType } from '../../../src/models/ContentType';

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

  beforeEach(async () => {
    await ContentItem.deleteMany({});
    await ContentType.deleteMany({});

    // Create a mock content type
    const contentType = new ContentType({
      companyId: mockCompanyId,
      name: 'Test Content Type',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'string', required: true },
        { name: 'tags', type: 'array', required: false }
      ]
    });
    await contentType.save();
    mockContentTypeId = contentType._id.toString();
  });

  it('should create a content item', async () => {
    const contentData = {
      title: 'Test Content',
      body: 'This is a test content',
      tags: ['test', 'content']
    };

    const createdContent = await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData) as IContentItem;

    expect(createdContent).toBeDefined();
    expect(createdContent.data.title).toBe(contentData.title);
    expect(createdContent.companyId.toString()).toBe(mockCompanyId);
    expect(createdContent.contentTypeId.toString()).toBe(mockContentTypeId);
  });

  it('should get all content items for a company', async () => {
    const contentData1 = { title: 'Content 1', body: 'Body 1' };
    const contentData2 = { title: 'Content 2', body: 'Body 2' };

    await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData1);
    await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData2);

    const contentItems = await ContentService.getContentItems(mockCompanyId);

    expect(contentItems).toHaveLength(2);
    // Check that items are sorted by createdAt in descending order
    expect(contentItems[0].data.title).toBe(contentData2.title);
    expect(contentItems[1].data.title).toBe(contentData1.title);
  });

  it('should update a content item', async () => {
    const contentData = { title: 'Original Title', body: 'Original body' };
    const createdContent = await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData) as IContentItem;

    const updatedData = { title: 'Updated Title', body: 'Updated body' };
    const updatedContent = await ContentService.updateContentItem(createdContent._id.toString(), mockCompanyId, updatedData) as IContentItem;

    expect(updatedContent).toBeDefined();
    expect(updatedContent?.data.title).toBe(updatedData.title);
    expect(updatedContent?.data.body).toBe(updatedData.body);
  });

  it('should delete a content item', async () => {
    const contentData = { title: 'To be deleted', body: 'This will be deleted' };
    const createdContent = await ContentService.createContentItem(mockCompanyId, mockContentTypeId, contentData) as IContentItem;

    const result = await ContentService.deleteContentItem(createdContent._id.toString(), mockCompanyId);

    expect(result).toBe(true);

    const contentItems = await ContentService.getContentItems(mockCompanyId);
    expect(contentItems).toHaveLength(0);
  });
});
