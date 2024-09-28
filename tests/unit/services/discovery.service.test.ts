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
        
        // Check that the id follows the format: IntegrationName.actionName
        // Allow for multi-word integration names
        expect(action.id).toMatch(/^([A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+)*)\.[a-zA-Z0-9]+$/);
        
        // Ensure that the service name is capitalized
        expect(action.service[0]).toMatch(/[A-Z]/);
      });
      
      // Log the first action for manual inspection
      console.log('Sample action:', JSON.stringify(actions[0], null, 2));
    });
  });
});