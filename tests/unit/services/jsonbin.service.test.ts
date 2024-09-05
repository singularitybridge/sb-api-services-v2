import axios from 'axios';
import { createFile, readFile, updateFile, updateArrayElement, verifyJsonBinKey } from '../../../src/services/jsonbin.service';
import { getApiKey } from '../../../src/services/api.key.service';

jest.mock('axios');
jest.mock('../../../src/services/api.key.service');

describe('JsonbinService', () => {
  const mockCompanyId = 'test-company-id';
  const mockBinId = 'test-bin-id';
  const mockData = { key: 'value' };
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    (getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
    console.error = jest.fn(); // Mock console.error
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createFile', () => {
    it('should create a new bin', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { id: mockBinId } });

      const result = await createFile(mockCompanyId, mockData);

      expect(result).toEqual({ id: mockBinId });
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.jsonbin.io/v3/b',
        mockData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Master-Key': mockApiKey,
          }),
        })
      );
    });
  });

  describe('readFile', () => {
    it('should read a bin', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { record: mockData } });

      const result = await readFile(mockCompanyId, mockBinId);

      expect(result).toEqual(mockData);
      expect(axios.get).toHaveBeenCalledWith(
        `https://api.jsonbin.io/v3/b/${mockBinId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Master-Key': mockApiKey,
          }),
        })
      );
    });
  });

  describe('updateFile', () => {
    it('should update a bin', async () => {
      (axios.put as jest.Mock).mockResolvedValue({ data: { record: mockData } });

      const result = await updateFile(mockCompanyId, mockBinId, mockData);

      expect(result).toEqual(mockData);
      expect(axios.put).toHaveBeenCalledWith(
        `https://api.jsonbin.io/v3/b/${mockBinId}`,
        mockData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Master-Key': mockApiKey,
          }),
        })
      );
    });
  });

  describe('updateArrayElement', () => {
    const mockArrayData = {
      hobbies: [
        { id: '1x', title: 'swimming', description: '...' },
        { id: '2x', title: 'running', description: '...' },
      ],
    };

    it('should update an array element', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { record: mockArrayData } });
      (axios.put as jest.Mock).mockResolvedValue({
        data: {
          record: {
            hobbies: [
              { id: '1x', title: 'swimming', description: '...' },
              { id: '2x', title: 'new title', description: '...' },
            ],
          },
        },
      });

      const result = await updateArrayElement(mockCompanyId, mockBinId, 'hobbies', '2x', { title: 'new title' });

      expect(result).toEqual({
        hobbies: [
          { id: '1x', title: 'swimming', description: '...' },
          { id: '2x', title: 'new title', description: '...' },
        ],
      });
      expect(axios.put).toHaveBeenCalledWith(
        `https://api.jsonbin.io/v3/b/${mockBinId}`,
        {
          hobbies: [
            { id: '1x', title: 'swimming', description: '...' },
            { id: '2x', title: 'new title', description: '...' },
          ],
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Master-Key': mockApiKey,
          }),
        })
      );
    });

    it('should throw an error if the array key is not found', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { record: { otherKey: [] } } });

      await expect(updateArrayElement(mockCompanyId, mockBinId, 'nonexistentArray', '2x', { title: 'new title' })).rejects.toThrow(
        "Array 'nonexistentArray' not found in the JSON file"
      );
    });

    it('should throw an error if the element id is not found', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { record: mockArrayData } });

      await expect(updateArrayElement(mockCompanyId, mockBinId, 'hobbies', 'nonexistentId', { title: 'new title' })).rejects.toThrow(
        "Element with id 'nonexistentId' not found in the array 'hobbies'"
      );
    });
  });

  describe('verifyJsonBinKey', () => {
    it('should return true for a valid key', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await verifyJsonBinKey(mockApiKey);

      expect(result).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.jsonbin.io/v3/c',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Master-key': mockApiKey,
          }),
        })
      );
    });

    it('should return false for an invalid key', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Invalid key'));

      const result = await verifyJsonBinKey(mockApiKey);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Error verifying JSONBin key:', expect.any(Error));
    });
  });
});