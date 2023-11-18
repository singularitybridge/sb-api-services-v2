import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import express from "express";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();
const calendarId =
  "0d504cdef77336818a64a4d89b331d90951ae2dcb28444de7dd4ab1de8af35d2@group.calendar.google.com";

// Initialize the OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Load saved tokens (if they exist)
if (fs.existsSync(path.join(__dirname, "tokens.json"))) {
  const tokens = JSON.parse(
    fs.readFileSync(path.join(__dirname, "tokens.json"), "utf-8")
  );
  oauth2Client.setCredentials(tokens);
}

// Generate a URL that asks permissions for Google Calendar scopes
const scopes = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

// Direct the user to the generated URL
console.log("Visit this URL to authorize the application:", url);

// Initialize the calendar client
const calendar = google.calendar({ version: "v3", auth: oauth2Client });


const getEventsInRange = async (startDate: Date, endDate: Date) => {

  endDate.setHours(23, 59, 59, 999); // Set to end of the day

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
    throw new Error("Error fetching events");
  }
};


router.get("/events", async (req, res) => {

  const { start, end } = req.query;
  
  if (!Date.parse(start as string) || !Date.parse(end as string)) {
    return res.status(400).send("Invalid start or end date");
  }

  const startDate = new Date(start as string);
  const endDate = new Date(end as string);

  const events = await getEventsInRange(startDate, endDate);
  res.json(events);

  
});

router.get("/free-slots", async (req, res) => {

  const { start, end } = req.query;
  
  if (!Date.parse(start as string) || !Date.parse(end as string)) {
    return res.status(400).send("Invalid start or end date");
  }
  const startDate = new Date(start as string);
  const endDate = new Date(end as string);
  
  const events = await getEventsInRange(startDate, endDate);

  console.log('found ...');
  console.log(events);

  // Calculate free time slots
  const freeSlots = events ? findFreeSlots(events, startDate, endDate) : [];

  res.json(freeSlots);
});

const findFreeSlots = (events: any[], startDate: Date, endDate: Date) => {
  const freeSlots = [];
  let lastEventEnd = new Date(startDate);
  const requiredSlotTime = 60 * 60 * 1000; // 1 hour in milliseconds
  const startTime = new Date(startDate);
  startTime.setHours(9, 30, 0); // Set the start time to 09:30

  events.forEach(event => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);

    if (eventStart.getTime() - lastEventEnd.getTime() >= requiredSlotTime) {
      const slotStart = new Date(lastEventEnd);
      const slotEnd = new Date(lastEventEnd.getTime() + requiredSlotTime);
      if (slotStart >= startTime && slotEnd <= endDate && slotEnd.getHours() <= 17) {
        freeSlots.push({ start: slotStart, end: slotEnd });
      }
    }

    lastEventEnd = eventEnd;
  });

  // Check for a slot after the last event
  if (endDate.getTime() - lastEventEnd.getTime() >= requiredSlotTime) {
    const slotStart = new Date(lastEventEnd);
    const slotEnd = new Date(lastEventEnd.getTime() + requiredSlotTime);
    if (slotStart >= startTime && slotEnd <= endDate && slotEnd.getHours() <= 17) {
      freeSlots.push({ start: slotStart, end: slotEnd });
    }
  }

  return freeSlots.map(slot => ({
    start: slot.start.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }),
    end: slot.end.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })
  }));
}



router.get("/calendars", async (req, res) => {
  try {
    const calendarList = await calendar.calendarList.list();
    const calendars = calendarList.data.items?.map((item) => ({
      id: item.id,
      name: item.summary,
    }));
    res.json(calendars);
  } catch (error: any) {
    res.status(500).send((error as Error).message);
  }
});

router.post("/events", async (req, res) => {
  // Create a new event
  const event = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: req.body,
  });

  res.json(event.data);
});

router.put("/events/:id", async (req, res) => {
  // Get the existing event
  const existingEvent = await calendar.events.get({
    calendarId: calendarId,
    eventId: req.params.id,
  });

  if (!existingEvent.data) {
    return res.status(404).send("Event not found");
  }

  // Update the fields with the new values from the request body
  const updatedEvent = {
    ...existingEvent.data,
    ...req.body,
  };

  // Update the event
  const event = await calendar.events.update({
    calendarId: calendarId,
    eventId: req.params.id,
    requestBody: updatedEvent,
  });

  res.json(event.data);
});

router.delete("/events/:id", async (req, res) => {
  // Delete an event
  await calendar.events.delete({
    calendarId: calendarId,
    eventId: req.params.id,
  });

  res.send("Event deleted successfully");
});

router.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (code) {
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      // Save the tokens to a file
      fs.writeFileSync(
        path.join(__dirname, "tokens.json"),
        JSON.stringify(tokens)
      );

      res.send("Authentication successful! You can close this tab.");
    } catch (error) {
      res.send("Error retrieving access token");
    }
  }
});

export default router;
