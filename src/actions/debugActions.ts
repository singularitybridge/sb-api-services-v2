import { ActionContext, FunctionFactory } from './types';
import { Session } from '../models/Session';
import { getUserById } from '../services/user.service';
import { getCompany } from '../services/company.service';

export const createDebugActions = (context: ActionContext): FunctionFactory => ({
  getSessionInfo: {
    description: 'Get basic session info for debug purposes',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        const user = await getUserById(session.userId);
        if (!user) {
          throw new Error('User not found');
        }

        const company = await getCompany(context.companyId);

        const info = {
          sessionId: context.sessionId,
          userId: user._id.toString(),
          userName: user.name,
          companyId: company._id.toString(),
          companyName: company.name,
        };

        const markdown = `
| Property    | Value                |
|-------------|----------------------|
| Session ID  | ${info.sessionId}    |
| User ID     | ${info.userId}       |
| User Name   | ${info.userName}     |
| Company ID  | ${info.companyId}    |
| Company Name| ${info.companyName}  |
        `;

        return { markdown };
      } catch (error) {
        console.error('getSessionInfo: Error fetching session info', error);
        return {
          error: 'Error fetching session info',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  },
});