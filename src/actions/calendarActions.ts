import { IEventRequestBody } from '../Interfaces/eventRequest.interface';
import { createEvent, deleteEvent, updateEvent } from '../services/google.calendar.service';
import { FunctionFactory, ActionContext } from '../integrations/actions/types';

export const createCalendarActions = (context: ActionContext): FunctionFactory => ({
  createEvent: {
    description: 'Create a new calendar event',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'The title of the event' },
        description: { type: 'string', description: 'The description of the event' },
        start: { type: 'string', description: 'The start time of the event (ISO 8601 format)' },
        end: { type: 'string', description: 'The end time of the event (ISO 8601 format)' },
      },
      required: ['summary', 'start', 'end'],
    },
    function: async (args: IEventRequestBody) => {      
      const eventCreationResponse = await createEvent(args);
      return eventCreationResponse;
    },
  },
  updateEvent: {
    description: 'Update an existing calendar event',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The ID of the event to update' },
        eventData: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'The updated title of the event' },
            description: { type: 'string', description: 'The updated description of the event' },
            start: { type: 'string', description: 'The updated start time of the event (ISO 8601 format)' },
            end: { type: 'string', description: 'The updated end time of the event (ISO 8601 format)' },
          },
        },
      },
      required: ['id', 'eventData'],
    },
    function: async (args: { id: string; eventData: IEventRequestBody }) => {      
      const updateResponse = await updateEvent(args.id, args.eventData);
      return updateResponse;
    },
  },
  deleteEvent: {
    description: 'Delete a calendar event',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The ID of the event to delete' },
      },
      required: ['id'],
    },
    function: async (args: { id: string }) => {      
      const deleteResponse = await deleteEvent(args.id);
      return deleteResponse;
    },
  },
});