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

export const createFunctionFactory = (context: ActionContext): FunctionFactory => ({
  ...createInboxActions(context),
  ...createAssistantActions(context),
  ...createCalendarActions(context),
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
});

export const executeFunctionCall = async (call: any, sessionId: string, companyId: string) => {
  const context: ActionContext = { sessionId, companyId };
  const functionFactory = createFunctionFactory(context);
  
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
