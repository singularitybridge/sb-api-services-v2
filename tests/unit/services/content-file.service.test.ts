import { uploadContentFile, getContentFiles, deleteContentFile } from '../../../src/services/content-file.service';
import mongoose from 'mongoose';

jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue([]),
          getSignedUrl: jest.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/test-file']),
        }),
      }),
    })),
  };
});

jest.mock('../../../src/models/ContentFile', () => {
  return {
    ContentFile: jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    })),
  };
});

describe('Content File Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadContentFile', () => {
    it('should upload a file and save content file data', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('test content'),
        mimetype: 'text/plain',
        size: 12,
      } as Express.Multer.File;

      const mockCompanyId = new mongoose.Types.ObjectId().toString();
      const mockTitle = 'Test File';
      const mockDescription = 'Test Description';
      const mockSessionId = new mongoose.Types.ObjectId().toString();
      const mockContent = 'Additional content';

      const mockUrl = 'https://storage.googleapis.com/test-bucket/test-file';

      const result = await uploadContentFile(mockFile, mockCompanyId, mockTitle, mockDescription, mockSessionId, mockContent);

      expect(result).toEqual(expect.objectContaining({
        filename: mockFile.originalname,
        title: mockTitle,
        description: mockDescription,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: mockUrl,
        companyId: expect.any(mongoose.Types.ObjectId),
        sessionId: expect.any(mongoose.Types.ObjectId),
        content: mockContent,
      }));
    });

    it('should upload a file without optional fields', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('test content'),
        mimetype: 'text/plain',
        size: 12,
      } as Express.Multer.File;

      const mockCompanyId = new mongoose.Types.ObjectId().toString();
      const mockTitle = 'Test File';

      const mockUrl = 'https://storage.googleapis.com/test-bucket/test-file';

      const result = await uploadContentFile(mockFile, mockCompanyId, mockTitle);

      expect(result).toEqual(expect.objectContaining({
        filename: mockFile.originalname,
        title: mockTitle,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: mockUrl,
        companyId: expect.any(mongoose.Types.ObjectId),
      }));

      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('sessionId');
      expect(result).not.toHaveProperty('content');
    });
  });

  // Add tests for getContentFiles and deleteContentFile here
});