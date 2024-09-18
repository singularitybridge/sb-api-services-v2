import { FunctionFactory, ActionContext } from './types';
import { createInboxActions } from './inboxActions';
import { createAssistantActions } from './assistantActions';
import { createCalendarActions } from './calendarActions';
import { createJSONBinActions } from './jsonbinActions';
import { createFluxImageActions } from './fluxImageActions';
import { createPerplexityActions } from './perplexityActions';
import { createSendGridActions } from './sendgridActions';
import { createElevenLabsActions } from './elevenLabsActions';
import { createOpenAiActions } from './openAiActions';
import { processTemplate } from '../services/template.service';
import { createPhotoRoomActions } from './photoRoomActions';
import { createMongoDbActions } from './mongoDbActions';
import { createDebugActions } from './debugActions';
import { createAgendaActions } from './agendaActions';
import createAIAgentExecutorActions from './aiAgentExecutorActions';
import { createLinearActions } from './linearActions';
import { createJournalActions } from './journalActions';
import { createContentActions } from './contentActions'; // Import the new content actions

export const createFunctionFactory = (context: ActionContext, allowedActions: string[]): FunctionFactory => {
  const allActions = {
    ...createInboxActions(context),
    ...createAssistantActions(context),
    // ...createCalendarActions(context),
    ...createJSONBinActions(context),
    ...createFluxImageActions(context),
    ...createPerplexityActions(context),
    ...createSendGridActions(context),
    ...createElevenLabsActions(context),
    ...createOpenAiActions(context),
    ...createPhotoRoomActions(context),
    ...createMongoDbActions(context),
    ...createDebugActions(context),
    ...createAgendaActions(context),
    ...createAIAgentExecutorActions(context),
    ...createLinearActions(context),
    ...createJournalActions(context),
    ...createContentActions(context), // Add the new content actions
  };

  // Adjust the action names to strip off the service prefix
  const adjustedActions = Object.fromEntries(
    Object.entries(allActions).map(([actionName, funcDef]) => {
      const parts = actionName.split('.');
      const adjustedName = parts.length > 1 ? parts[1] : actionName;
      return [adjustedName, funcDef];
    })
  );

  // Adjust allowedActions to strip off service prefixes
  const adjustedAllowedActions = allowedActions.map(actionName => {
    const parts = actionName.split('.');
    return parts.length > 1 ? parts[1] : actionName;
  });

  return Object.fromEntries(
    Object.entries(adjustedActions).filter(([actionName]) => adjustedAllowedActions.includes(actionName))
  ) as FunctionFactory;
};

export const executeFunctionCall = async (call: any, sessionId: string, companyId: string, allowedActions: string[]) => {
  const context: ActionContext = { sessionId, companyId };

  // Adjust allowedActions to remove service prefixes
  const adjustedAllowedActions = allowedActions.map(actionName => {
    const parts = actionName.split('.');
    return parts.length > 1 ? parts[1] : actionName;
  });

  const functionFactory = createFunctionFactory(context, adjustedAllowedActions);
  
  const functionName = call.function.name as keyof FunctionFactory;

  if (functionName in functionFactory) {
    let args = JSON.parse(call.function.arguments);
    console.log('processing args', args);
    // Process each argument with the template service
    for (const key in args) {
      if (typeof args[key] === 'string') {
        args[key] = await processTemplate(args[key], sessionId);
      }
    }

    return await functionFactory[functionName].function(args);
  } else {
    throw new Error(`Function ${functionName} not implemented in the factory`);
  }
};
