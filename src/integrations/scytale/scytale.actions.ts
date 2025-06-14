import { ActionContext, FunctionFactory } from '../actions/types';
import { getQuestionnaires, getQuestionnaireById } from './scytale.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError, ActionExecutionError } from '../../utils/actionErrors'; // Added ActionExecutionError just in case, though ActionServiceError is primary from executeAction

// Assuming types for the data payload
interface ScytaleQuestionnaire {
  // Define structure based on actual questionnaire object
  id: string;
  name: string;
  // ... other properties
}

interface GetQuestionnaireByIdArgs {
  questionnaireId: string;
}

export const createScytaleActions = (context: ActionContext): FunctionFactory => ({
  getQuestionnaires: {
    description: 'Fetches all questionnaires from Scytale AI for the configured company.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      const actionName = 'getQuestionnaires';
      // Assuming context.sessionId and context.companyId are validated/guaranteed by the framework
      // If not, add checks here:
      // if (!context.sessionId) throw new ActionExecutionError('Session ID is missing', { actionName, statusCode: 400 });
      // if (!context.companyId) throw new ActionExecutionError('Company ID is missing', { actionName, statusCode: 400 });

      return executeAction<ScytaleQuestionnaire[]>(
        actionName,
        async () => {
          const serviceResult = await getQuestionnaires(context.sessionId, context.companyId);
          // Adapt if serviceResult uses 'error' for message instead of 'description'
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          return serviceResult; // executeAction expects { success, data, description? }
        },
        { serviceName: 'ScytaleService' }
      );
    },
  },
  getQuestionnaire: {
    description: 'Fetches a single questionnaire by its ID from Scytale AI.',
    parameters: {
      type: 'object',
      properties: {
        questionnaireId: { type: 'string', description: 'The ID of the questionnaire to fetch.' },
      },
      required: ['questionnaireId'],
      additionalProperties: false,
    },
    function: async (params: GetQuestionnaireByIdArgs) => {
      const actionName = 'getQuestionnaire';
      if (!params.questionnaireId) {
        throw new ActionValidationError('questionnaireId is required.', {
          fieldErrors: { questionnaireId: 'questionnaireId is required.' },
        });
      }
      // Assuming context.sessionId and context.companyId are validated/guaranteed

      return executeAction<ScytaleQuestionnaire>(
        actionName,
        async () => {
          const serviceResult = await getQuestionnaireById(context.sessionId, context.companyId, params.questionnaireId);
          // Adapt if serviceResult uses 'error' for message instead of 'description'
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          return serviceResult; // executeAction expects { success, data, description? }
        },
        { serviceName: 'ScytaleService' }
      );
    },
  },
});
