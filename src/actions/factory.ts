// file_path: /src/actions/factory.ts

import { FunctionFactory, ActionContext } from './types';
import { createInboxActions } from './inboxActions';
import { createAssistantActions } from './assistantActions';
import { createCalendarActions } from './calendarActions';
import { createJSONBinActions } from './jsonbinActions';

export const createFunctionFactory = (context: ActionContext): FunctionFactory => ({
  ...createInboxActions(context),
  ...createAssistantActions(context),
  ...createCalendarActions(context),
  ...createJSONBinActions(context),
});

export const executeFunctionCall = async (call: any, sessionId: string, companyId: string) => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = createFunctionFactory(context);
  
  const functionName = call.function.name as keyof FunctionFactory;

  if (functionName in functionFactory) {
    const args = JSON.parse(call.function.arguments);
    return await functionFactory[functionName].function(args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};
