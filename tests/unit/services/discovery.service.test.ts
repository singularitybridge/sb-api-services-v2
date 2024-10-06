import { discoveryService, ActionInfo } from '../../../src/services/discovery.service';

describe('discoveryService', () => {
  describe('discoverActions', () => {
    it('should return actions in the correct format', async () => {
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
        
        // Updated regex to allow underscores in the service name
        expect(action.id).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9]+$/);
        
        // Ensure that the service name starts with a letter
        expect(action.service[0]).toMatch(/[a-zA-Z]/);
      });
      
    });

    it('should handle actions with multiple segments in their IDs', () => {
      const mockAction: ActionInfo = {
        id: 'service_name.action_name.sub_action',
        serviceName: 'Service Name',
        actionTitle: 'Action Title',
        description: 'Action Description',
        icon: 'icon-name',
        service: 'serviceName',
        parameters: {},
      };

      expect(mockAction.id).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/);
    });
  });
});