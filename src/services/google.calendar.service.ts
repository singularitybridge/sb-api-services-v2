import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { IEvent, IEventCreationResponse } from '../Interfaces/event.interface';
import { ICalendar } from '../Interfaces/calendar.interface';
import { IEventRequestBody } from '../Interfaces/eventRequest.interface';

let oauth2Client: OAuth2Client | undefined;
let calendar: any; // Using 'any' for google.calendar object, or define a more specific type

const TOKEN_PATH = path.join(__dirname, 'tokens.json');
const calendarId =
  '0d504cdef77336818a64a4d89b331d90951ae2dcb28444de7dd4ab1de8af35d2@group.calendar.google.com';

if (
  process.env.CLIENT_ID &&
  process.env.CLIENT_SECRET &&
  process.env.REDIRECT_URL
) {
  oauth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL,
  );
  calendar = google.calendar({ version: 'v3', auth: oauth2Client });
} else {
  console.warn(
    'Google Calendar credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URL) not found. Google Calendar service will not be available.',
  );
}

export const initGoogleCalendar = () => {
  if (!oauth2Client) {
    console.warn(
      'Google Calendar client not initialized. Skipping initGoogleCalendar.',
    );
    return;
  }
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(tokens);
    // Automatically refresh the access token
    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.refresh_token) {
        // Save the new refresh token
        tokens.refresh_token = newTokens.refresh_token;
      }
      // Save the new access token
      tokens.access_token = newTokens.access_token;
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    });
  }
};

export const handleOAuth2Callback = async (code: string) => {
  if (!oauth2Client) {
    throw new Error(
      'Google Calendar client not initialized. Cannot handle OAuth2 callback.',
    );
  }
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens)); // Save the tokens
  return tokens;
};

export const generateAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  if (!oauth2Client) {
    console.error(
      'Google Calendar client not initialized. Cannot generate auth URL.',
    );
    return 'Google Calendar client not initialized. Cannot generate auth URL.'; // Or throw an error
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  console.log('Visit this URL to authorize the application:', url);
};

export const getEventsInRange = async (
  startDate: Date,
  endDate: Date,
): Promise<IEvent[]> => {
  try {
    if (!calendar || !oauth2Client) {
      console.warn(
        'Google Calendar service not initialized. Cannot get events.',
      );
      return [];
    }
    const events = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    if (!events.data.items) {
      return [];
    }

    const simplifiedEvents: IEvent[] = events.data.items.map((event: any) => ({
      id: event.id ?? '',
      title: event.summary ?? '',
      description: event.description ?? '',
      startDate: new Date(event.start?.dateTime ?? ''),
      endDate: new Date(event.end?.dateTime ?? ''),
    }));

    return simplifiedEvents;
  } catch (error) {
    throw new Error((error as Error).message);
  }
};

export const listCalendars = async (): Promise<ICalendar[]> => {
  try {
    if (!calendar || !oauth2Client) {
      console.warn(
        'Google Calendar service not initialized. Cannot list calendars.',
      );
      return [];
    }
    const calendarList = await calendar.calendarList.list();
    return (
      calendarList.data.items?.map((item: any) => ({
        id: item.id!,
        name: item.summary!,
      })) || []
    );
  } catch (error: any) {
    throw new Error((error as Error).message);
  }
};

export const createEvent = async (
  eventData: IEventRequestBody,
): Promise<IEventCreationResponse> => {
  if (!calendar || !oauth2Client) {
    throw new Error(
      'Google Calendar service not initialized. Cannot create event.',
    );
  }
  const event = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: eventData,
  });
  return { id: event.data.id! };
};

export const updateEvent = async (
  eventId: string,
  eventData: IEventRequestBody,
) => {
  try {
    if (!calendar || !oauth2Client) {
      throw new Error(
        'Google Calendar service not initialized. Cannot update event.',
      );
    }
    await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: eventData,
    });
    return { message: 'Event updated successfully' };
  } catch (error: any) {
    throw new Error((error as Error).message);
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    if (!calendar || !oauth2Client) {
      throw new Error(
        'Google Calendar service not initialized. Cannot delete event.',
      );
    }
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    });
  } catch (error: any) {
    throw new Error((error as Error).message);
  }
};
