import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import express from "express";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();

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

router.get("/events", async (req, res) => {
  const { start, end } = req.query;

  // Convert the dates to JavaScript Date objects
  const startDate = new Date(`${start as string}T00:00:00`);
  const endDate = new Date(`${end as string}T23:59:59`);

  // Get the events
  const events = await calendar.events.list({
    calendarId: "primary",
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  if (!events.data.items) {
    return res.json([]);
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

  res.json(simplifiedEvents);
});

router.post("/events", async (req, res) => {
  // Create a new event
  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: req.body,
  });

  res.json(event.data);
});

router.put("/events/:id", async (req, res) => {
  // Update an event
  const event = await calendar.events.update({
    calendarId: "primary",
    eventId: req.params.id,
    requestBody: req.body,
  });

  res.json(event.data);
});

router.delete("/events/:id", async (req, res) => {
  // Delete an event
  await calendar.events.delete({
    calendarId: "primary",
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
