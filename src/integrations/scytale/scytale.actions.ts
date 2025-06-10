import { ActionContext, FunctionFactory } from '../actions/types';
import { getQuestionnaires, getQuestionnaireById } from './scytale.service';

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
      // The service function expects sessionId and companyId, which are in the context
      const serviceResponse = await getQuestionnaires(context.sessionId, context.companyId);
      if (!serviceResponse.success) {
        // If the service function explicitly returned success: false, throw its error.
        // If the service function threw an error (e.g., network issue, non-2xx response),
        // that error would have been caught by the executor already.
        throw new Error(serviceResponse.error || 'Failed to get questionnaires from Scytale AI');
      }
      // On success, return the entire object from the service, including { success: true, data: ... }
      return serviceResponse;
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
      const serviceResponse = await getQuestionnaireById(context.sessionId, context.companyId, params.questionnaireId);
      if (!serviceResponse.success) {
        throw new Error(serviceResponse.error || `Failed to get questionnaire ${params.questionnaireId} from Scytale AI`);
      }
      // On success, return the entire object from the service
      return serviceResponse;
    },
  },
});
