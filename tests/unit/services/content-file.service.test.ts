import { uploadContentFile, getContentFiles, deleteContentFile } from '../../../src/services/content-file.service';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue([]),
          getSignedUrl: jest.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/test-file']),
          delete: jest.fn().mockResolvedValue([]),
        }),
      }),
    })),
  };
});

const mockContentFileModel = {
  save: jest.fn().mockResolvedValue({}),
  toObject: jest.fn().mockReturnValue({}),
  deleteOne: jest.fn().mockResolvedValue({}),
};

jest.mock('../../../src/models/ContentFile', () => {
  return {
    ContentFile: jest.fn().mockImplementation((data) => ({
      ...mockContentFileModel,
      ...data,
    })),
  };
});

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    Types: {
      ...actualMongoose.Types,
      ObjectId: jest.fn().mockImplementation((id) => id),
    },
    model: jest.fn().mockReturnValue({
      find: jest.fn(),
      findOne: jest.fn(),
    }),
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

      const mockCompanyId = 'mockCompanyId';
      const mockTitle = 'Test File';
      const mockDescription = 'Test Description';
      const mockSessionId = 'mockSessionId';
      const mockContent = 'Additional content';

      mockContentFileModel.toObject.mockReturnValue({
        filename: mockFile.originalname,
        title: mockTitle,
        description: mockDescription,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: `https://storage.googleapis.com/your-default-bucket-name/mocked-uuid.txt`,
        sessionId: mockSessionId,
        content: mockContent,
      });

      const result = await uploadContentFile(mockFile, mockCompanyId, mockTitle, mockDescription, mockSessionId, mockContent);

      expect(result).toEqual(expect.objectContaining({
        filename: mockFile.originalname,
        title: mockTitle,
        description: mockDescription,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: expect.stringContaining('https://storage.googleapis.com/'),
        sessionId: mockSessionId,
        content: mockContent,
      }));

      expect(result).not.toHaveProperty('companyId');
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(mockCompanyId);
    });

    it('should upload a file without optional fields', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('test content'),
        mimetype: 'text/plain',
        size: 12,
      } as Express.Multer.File;

      const mockCompanyId = 'mockCompanyId';
      const mockTitle = 'Test File';

      mockContentFileModel.toObject.mockReturnValue({
        filename: mockFile.originalname,
        title: mockTitle,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: `https://storage.googleapis.com/your-default-bucket-name/mocked-uuid.txt`,
      });

      const result = await uploadContentFile(mockFile, mockCompanyId, mockTitle);

      expect(result).toEqual(expect.objectContaining({
        filename: mockFile.originalname,
        title: mockTitle,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        gcpStorageUrl: expect.stringContaining('https://storage.googleapis.com/'),
      }));

      expect(result).not.toHaveProperty('companyId');
      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('sessionId');
      expect(result).not.toHaveProperty('content');
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(mockCompanyId);
    });
  });

  describe('getContentFiles', () => {
    it('should fetch content files for a company', async () => {
      const mockCompanyId = 'mockCompanyId';
      const mockFiles = [
        { _id: 'file1', title: 'File 1' },
        { _id: 'file2', title: 'File 2' },
      ];

      const ContentFile = require('../../../src/models/ContentFile').ContentFile;
      ContentFile.find = jest.fn().mockResolvedValue(mockFiles);

      const result = await getContentFiles(mockCompanyId);

      expect(result).toEqual(mockFiles);
      expect(ContentFile.find).toHaveBeenCalledWith({ companyId: expect.any(mongoose.Types.ObjectId) });
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(mockCompanyId);
    });

    it('should throw an error if fetching content files fails', async () => {
      const mockCompanyId = 'mockCompanyId';
      const mockError = new Error('Database error');

      const ContentFile = require('../../../src/models/ContentFile').ContentFile;
      ContentFile.find = jest.fn().mockRejectedValue(mockError);

      await expect(getContentFiles(mockCompanyId)).rejects.toThrow('Database error');
    });
  });

  describe('deleteContentFile', () => {
    it('should delete a content file', async () => {
      const mockFileId = 'mockFileId';
      const mockCompanyId = 'mockCompanyId';
      const mockFile = {
        _id: mockFileId,
        gcpStorageUrl: 'https://storage.googleapis.com/test-bucket/test-file',
        deleteOne: jest.fn().mockResolvedValue({}),
      };

      const ContentFile = require('../../../src/models/ContentFile').ContentFile;
      ContentFile.findOne = jest.fn().mockResolvedValue(mockFile);

      const result = await deleteContentFile(mockFileId, mockCompanyId);

      expect(result).toEqual({ deleted: true });
      expect(ContentFile.findOne).toHaveBeenCalledWith({
        _id: expect.any(mongoose.Types.ObjectId),
        companyId: expect.any(mongoose.Types.ObjectId),
      });
      expect(mockFile.deleteOne).toHaveBeenCalled();
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(mockFileId);
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(mockCompanyId);
    });

    it('should throw an error if file is not found', async () => {
      const mockFileId = 'mockFileId';
      const mockCompanyId = 'mockCompanyId';

      const ContentFile = require('../../../src/models/ContentFile').ContentFile;
      ContentFile.findOne = jest.fn().mockResolvedValue(null);

      await expect(deleteContentFile(mockFileId, mockCompanyId)).rejects.toThrow('File not found or not owned by the company');
    });
  });
});