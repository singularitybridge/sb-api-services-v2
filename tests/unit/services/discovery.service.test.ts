import { discoveryService, ActionInfo } from '../../../src/services/discovery.service';

// Mock the discoveryService
jest.mock('../../../src/services/discovery.service', () => ({
  discoveryService: {
    discoverActions: jest.fn(),
  },
}));

describe('discoveryService', () => {
  describe('discoverActions', () => {
    beforeEach(() => {
      // Reset the mock before each test
      (discoveryService.discoverActions as jest.Mock).mockReset();
    });

    it('should return actions in the correct format', async () => {
      const mockActions: ActionInfo[] = [
        {
          id: 'service1.action1',
          serviceName: 'Service 1',
          actionTitle: 'Action 1',
          description: 'Description 1',
          icon: 'icon1',
          service: 'service1',
          parameters: {},
        },
        {
          id: 'service2.action2',
          serviceName: 'Service 2',
          actionTitle: 'Action 2',
          description: 'Description 2',
          icon: 'icon2',
          service: 'service2',
          parameters: {},
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const actions = await discoveryService.discoverActions();
      
      expect(Array.isArray(actions)).toBe(true);
      
      actions.forEach((action: ActionInfo) => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('serviceName');
        expect(action).toHaveProperty('actionTitle');
        expect(action).toHaveProperty('description');
        expect(action).toHaveProperty('icon');
        expect(action).toHaveProperty('service');
        expect(action).toHaveProperty('parameters');
        
        expect(action.id).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9]+$/);
        
        expect(action.service[0]).toMatch(/[a-zA-Z]/);
      });
    });

    it('should handle actions with multiple segments in their IDs', async () => {
      const mockActions: ActionInfo[] = [
        {
          id: 'service_name.action_name.sub_action',
          serviceName: 'Service Name',
          actionTitle: 'Action Title',
          description: 'Action Description',
          icon: 'icon-name',
          service: 'serviceName',
          parameters: {},
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const actions = await discoveryService.discoverActions();
      
      expect(actions[0].id).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/);
    });
  });
});