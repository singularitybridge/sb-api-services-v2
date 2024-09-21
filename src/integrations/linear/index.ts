import { ActionContext } from '../../actions/types';
import * as linearService from './linear.service';
import { createLinearActions } from './linear.actions';

export interface LinearIntegration {
  actions: ReturnType<typeof createLinearActions>;
  service: typeof linearService;
}

export const initializeLinearIntegration = (context: ActionContext): LinearIntegration => {
  const actions = createLinearActions(context);
  return {
    actions,
    service: linearService,
  };
};

export * from './linear.service';
export * from './linear.actions';