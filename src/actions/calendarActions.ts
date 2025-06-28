import { IEventRequestBody } from '../Interfaces/eventRequest.interface';
import { IEventCreationResponse } from '../Interfaces/event.interface'; // Corrected import path
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from '../services/google.calendar.service';
import {
  FunctionFactory,
  ActionContext,
  StandardActionResult,
} from '../integrations/actions/types'; // Import StandardActionResult

// Define data types for StandardActionResult payloads if they are specific
interface CreateEventData extends IEventCreationResponse {}
interface UpdateEventData {
  message: string;
}
interface DeleteEventData {
  message: string;
} // Or specific data

export const createCalendarActions = (
  context: ActionContext,
): FunctionFactory => ({
  createEvent: {
    description: 'Create a new calendar event',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'The title of the event' },
        description: {
          type: 'string',
          description: 'The description of the event',
        },
        start: {
          type: 'string',
          description: 'The start time of the event (ISO 8601 format)',
        },
        end: {
          type: 'string',
          description: 'The end time of the event (ISO 8601 format)',
        },
      },
      required: ['summary', 'start', 'end'],
    },
    function: async (
      args: IEventRequestBody,
    ): Promise<StandardActionResult<CreateEventData>> => {
      const eventCreationResponse = await createEvent(args);
      // Assuming createEvent throws on error, otherwise add error handling here
      return {
        success: true,
        message: 'Event created successfully.',
        data: eventCreationResponse as CreateEventData, // Cast if necessary
      };
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
            summary: {
              type: 'string',
              description: 'The updated title of the event',
            },
            description: {
              type: 'string',
              description: 'The updated description of the event',
            },
            start: {
              type: 'string',
              description:
                'The updated start time of the event (ISO 8601 format)',
            },
            end: {
              type: 'string',
              description:
                'The updated end time of the event (ISO 8601 format)',
            },
          },
        },
      },
      required: ['id', 'eventData'],
    },
    function: async (args: {
      id: string;
      eventData: IEventRequestBody;
    }): Promise<StandardActionResult<UpdateEventData>> => {
      const updateResponse = await updateEvent(args.id, args.eventData);
      // Assuming updateEvent returns { message: string } on success or throws on error
      // If updateResponse is just a message string, adapt accordingly.
      // Based on error log, it was Promise<{ message: string; }>
      let message = 'Event updated successfully.';
      if (
        typeof updateResponse === 'object' &&
        updateResponse !== null &&
        'message' in updateResponse
      ) {
        message = (updateResponse as { message: string }).message;
      } else if (typeof updateResponse === 'string') {
        message = updateResponse;
      }

      return {
        success: true,
        message: message,
        data: { message: message }, // Or specific data if available
      };
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
    function: async (args: {
      id: string;
    }): Promise<StandardActionResult<DeleteEventData>> => {
      await deleteEvent(args.id); // Assuming deleteEvent returns void on success or throws on error
      return {
        success: true,
        message: 'Event deleted successfully.',
        data: { message: 'Event deleted successfully.' }, // Optional data
      };
    },
  },
});
