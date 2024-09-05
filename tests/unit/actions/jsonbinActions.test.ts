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
        { title: 'new title' }
      );

      expect(result).toEqual({
        hobbies: [
          { id: '1x', title: 'swimming', description: '...' },
          { id: '2x', title: 'new title', description: '...' },
        ],
      });
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
        { title: 'new title' }
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
  });
});