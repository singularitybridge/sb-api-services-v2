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
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadContentFile', () => {
    // ... (keep existing tests)
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
      expect(console.error).toHaveBeenCalledWith('Error fetching content files:', mockError);
    });
  });

  describe('deleteContentFile', () => {
    // ... (keep existing tests)
  });
});