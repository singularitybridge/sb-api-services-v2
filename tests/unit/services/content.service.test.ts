import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as ContentService from '../../../src/services/content.service';
import { ContentItem } from '../../../src/models/ContentItem';

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

  beforeEach(async () => {
    await ContentItem.deleteMany({});
  });

  it('should create a content item', async () => {
    const contentData = {
      title: 'Test Content',
      contentType: 'text',
      content: { text: 'This is a test content' },
      metadata: { author: 'Test Author' },
      tags: ['test', 'content']
    };

    const createdContent = await ContentService.createContentItem(mockCompanyId, contentData);

    expect(createdContent).toBeDefined();
    expect(createdContent.title).toBe(contentData.title);
    expect(createdContent.companyId.toString()).toBe(mockCompanyId);
  });

  it('should get all content items for a company', async () => {
    const contentData1 = { title: 'Content 1', contentType: 'text', content: { text: 'Content 1' } };
    const contentData2 = { title: 'Content 2', contentType: 'text', content: { text: 'Content 2' } };

    await ContentService.createContentItem(mockCompanyId, contentData1);
    await ContentService.createContentItem(mockCompanyId, contentData2);

    const contentItems = await ContentService.getContentItems(mockCompanyId);

    expect(contentItems).toHaveLength(2);
    expect(contentItems[0].title).toBe(contentData1.title);
    expect(contentItems[1].title).toBe(contentData2.title);
  });

  it('should update a content item', async () => {
    const contentData = { title: 'Original Title', contentType: 'text', content: { text: 'Original content' } };
    const createdContent = await ContentService.createContentItem(mockCompanyId, contentData);

    const updatedData = { title: 'Updated Title', content: { text: 'Updated content' } };
    const updatedContent = await ContentService.updateContentItem(mockCompanyId, createdContent._id.toString(), updatedData);

    expect(updatedContent).toBeDefined();
    expect(updatedContent?.title).toBe(updatedData.title);
    expect(updatedContent?.content).toEqual(updatedData.content);
  });

  it('should delete a content item', async () => {
    const contentData = { title: 'To be deleted', contentType: 'text', content: { text: 'This will be deleted' } };
    const createdContent = await ContentService.createContentItem(mockCompanyId, contentData);

    await ContentService.deleteContentItem(mockCompanyId, createdContent._id.toString());

    const contentItems = await ContentService.getContentItems(mockCompanyId);
    expect(contentItems).toHaveLength(0);
  });
});