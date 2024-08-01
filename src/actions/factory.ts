import { FunctionFactory } from './types';
import { inboxActions } from './inboxActions';
import { assistantActions } from './assistantActions';
import { calendarActions } from './calendarActions';

export const functionFactory: FunctionFactory = {
  ...inboxActions,
  ...assistantActions,
  ...calendarActions,
};

export const executeFunctionCall = async (call: any) => {
  const functionName = call.function.name as keyof typeof functionFactory;

  if (functionName in functionFactory) {
    const args = JSON.parse(call.function.arguments);
    return await functionFactory[functionName].function(args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};