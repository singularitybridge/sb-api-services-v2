  import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";

export const oauth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

const calendarId =
  "0d504cdef77336818a64a4d89b331d90951ae2dcb28444de7dd4ab1de8af35d2@group.calendar.google.com";
const calendar = google.calendar({ version: "v3", auth: oauth2Client });

export const initGoogleCalendar = () => {
  if (fs.existsSync(path.join(__dirname, "tokens.json"))) {
    const tokens = JSON.parse(
      fs.readFileSync(path.join(__dirname, "tokens.json"), "utf-8")
    );
    oauth2Client.setCredentials(tokens);
  }
};

export const handleOAuth2Callback = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;  
};


export const generateAuthUrl = () => {
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });

  console.log("Visit this URL to authorize the application:", url);
  
};

export const getEventsInRange = async (startDate: Date, endDate: Date) => {
  try {
    const events = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    if (!events.data.items) {
      return [];
    }

    const simplifiedEvents = events.data.items.map((event) => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      startDate: event.start?.dateTime,
      endDate: event.end?.dateTime,
      googleMeetLink: event.hangoutLink,
      guests: event.attendees?.map((attendee) => ({
        name: attendee.displayName,
        email: attendee.email,
      })),
    }));

    return simplifiedEvents;
  } catch (error) {
    throw new Error((error as Error).message);
  }
};

export const listCalendars = async () => {
  try {
    const calendarList = await calendar.calendarList.list();
    return calendarList.data.items?.map((item) => ({
      id: item.id,
      name: item.summary,
    }));
  } catch (error: any) {
    throw new Error((error as Error).message);
  }
};

export const createEvent = async (eventData: any) => {
  const event = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: eventData,
  });
  return event.data;
};

export const updateEvent = async (eventId: string, updatedData: any) => {
  const event = await calendar.events.update({
    calendarId: calendarId,
    eventId: eventId,
    requestBody: updatedData,
  });
  return event.data;
};

export const deleteEvent = async (eventId: string) => {
  await calendar.events.delete({
    calendarId: calendarId,
    eventId: eventId,
  });
};
