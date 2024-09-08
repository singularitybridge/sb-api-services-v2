import { createJSONBinActions } from '../../../src/actions/jsonbinActions';
import * as jsonbinService from '../../../src/services/jsonbin.service';

jest.mock('../../../src/services/jsonbin.service');

describe('JSONBinActions', () => {
  const mockContext = {
    companyId: 'test-company-id',
    sessionId: 'test-session-id',
  };

  const actions = createJSONBinActions(mockContext);

  describe('updateJSONBinArrayElement', () => {
    it('should update a specific element in an array', async () => {
      const mockUpdateArrayElement = jsonbinService.updateArrayElement as jest.MockedFunction<typeof jsonbinService.updateArrayElement>;
      mockUpdateArrayElement.mockResolvedValue({
        hobbies: [
          { id: '1x', title: 'swimming', description: '...' },
          { id: '2x', title: 'new title', description: '...' },
        ],
      });

      const result = await actions.updateJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        elementId: '2x',
        updateData: { title: 'new title' },
      });

      expect(mockUpdateArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'hobbies',
        '2x',
        { title: 'new title' },
        false
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle errors when updating an element', async () => {
      const mockUpdateArrayElement = jsonbinService.updateArrayElement as jest.MockedFunction<typeof jsonbinService.updateArrayElement>;
      mockUpdateArrayElement.mockRejectedValue(new Error('Element not found'));

      const result = await actions.updateJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        elementId: 'non-existent',
        updateData: { title: 'new title' },
      });

      expect(mockUpdateArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'hobbies',
        'non-existent',
        { title: 'new title' },
        false
      );

      expect(result).toEqual({
        error: 'Update failed',
        message: 'Element not found',
      });
    });

    it('should validate input parameters', async () => {
      const result = await actions.updateJSONBinArrayElement.function({
        binId: 123, // Invalid type
        arrayKey: 'hobbies',
        elementId: '2x',
        updateData: { title: 'new title' },
      } as any); // Using 'as any' to bypass TypeScript checks for this test

      expect(result).toEqual({
        error: 'Invalid parameter types',
        message: 'binId, arrayKey, and elementId must be strings.',
      });
    });

    it('should handle invalid updateData', async () => {
      const result = await actions.updateJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        elementId: '2x',
        updateData: 'invalid data', // Should be an object
      } as any);

      expect(result).toEqual({
        error: 'Invalid JSON data',
        message: 'The provided updateData must be a valid JSON object. Received type: string',
      });
    });
  });

  describe('deleteJSONBinArrayElement', () => {
    it('should delete a specific element from an array', async () => {
      const mockDeleteArrayElement = jsonbinService.deleteArrayElement as jest.MockedFunction<typeof jsonbinService.deleteArrayElement>;
      mockDeleteArrayElement.mockResolvedValue({
        hobbies: [
          { id: '1x', title: 'swimming', description: '...' },
        ],
      });

      const result = await actions.deleteJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        elementId: '2x',
      });

      expect(mockDeleteArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'hobbies',
        '2x'
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle errors when deleting an element', async () => {
      const mockDeleteArrayElement = jsonbinService.deleteArrayElement as jest.MockedFunction<typeof jsonbinService.deleteArrayElement>;
      mockDeleteArrayElement.mockRejectedValue(new Error('Element not found'));

      const result = await actions.deleteJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        elementId: 'non-existent',
      });

      expect(mockDeleteArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'hobbies',
        'non-existent'
      );

      expect(result).toEqual({
        error: 'Delete failed',
        message: 'Element not found',
      });
    });

    it('should validate input parameters', async () => {
      const result = await actions.deleteJSONBinArrayElement.function({
        binId: 123, // Invalid type
        arrayKey: 'hobbies',
        elementId: '2x',
      } as any);

      expect(result).toEqual({
        error: 'Invalid parameter types',
        message: 'binId, arrayKey, and elementId must be strings.',
      });
    });
  });

  describe('insertJSONBinArrayElement', () => {
    it('should insert a new element into an array', async () => {
      const mockInsertArrayElement = jsonbinService.insertArrayElement as jest.MockedFunction<typeof jsonbinService.insertArrayElement>;
      mockInsertArrayElement.mockResolvedValue({
        hobbies: [
          { id: '1x', title: 'swimming', description: '...' },
          { id: '2x', title: 'new hobby', description: '...' },
        ],
      });

      const result = await actions.insertJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        newElement: { title: 'new hobby', description: '...' },
      });

      expect(mockInsertArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'hobbies',
        { title: 'new hobby', description: '...' }
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle errors when inserting an element', async () => {
      const mockInsertArrayElement = jsonbinService.insertArrayElement as jest.MockedFunction<typeof jsonbinService.insertArrayElement>;
      mockInsertArrayElement.mockRejectedValue(new Error('Invalid array key'));

      const result = await actions.insertJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'invalid-key',
        newElement: { title: 'new hobby', description: '...' },
      });

      expect(mockInsertArrayElement).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id',
        'invalid-key',
        { title: 'new hobby', description: '...' }
      );

      expect(result).toEqual({
        error: 'Insert failed',
        message: 'Invalid array key',
      });
    });

    it('should validate input parameters', async () => {
      const result = await actions.insertJSONBinArrayElement.function({
        binId: 'test-bin-id',
        arrayKey: 'hobbies',
        newElement: 'invalid element', // Should be an object
      } as any);

      expect(result).toEqual({
        error: 'Invalid JSON data',
        message: 'The provided newElement must be a valid JSON object. Received type: string',
      });
    });
  });

  describe('cloneJSONBinFile', () => {
    it('should clone a JSONBin file', async () => {
      const mockCloneJsonbin = jsonbinService.cloneJsonbin as jest.MockedFunction<typeof jsonbinService.cloneJsonbin>;
      mockCloneJsonbin.mockResolvedValue('cloned-bin-id');

      const result = await actions.cloneJSONBinFile.function({
        binId: 'test-bin-id',
      });

      expect(mockCloneJsonbin).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id'
      );

      expect(result).toEqual({ success: true, clonedBinId: 'cloned-bin-id' });
    });

    it('should handle errors when cloning a file', async () => {
      const mockCloneJsonbin = jsonbinService.cloneJsonbin as jest.MockedFunction<typeof jsonbinService.cloneJsonbin>;
      mockCloneJsonbin.mockRejectedValue(new Error('Clone failed'));

      const result = await actions.cloneJSONBinFile.function({
        binId: 'test-bin-id',
      });

      expect(mockCloneJsonbin).toHaveBeenCalledWith(
        'test-company-id',
        'test-bin-id'
      );

      expect(result).toEqual({
        error: 'Clone failed',
        message: 'Clone failed',
      });
    });

    it('should validate input parameters', async () => {
      const result = await actions.cloneJSONBinFile.function({
        binId: 123, // Invalid type
      } as any);

      expect(result).toEqual({
        error: 'Invalid binId',
        message: 'The binId must be a string.',
      });
    });
  });
});