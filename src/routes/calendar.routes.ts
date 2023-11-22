import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import express from "express";
import { findFreeSlots } from "../services/booking.service";
import {
  createEvent,
  deleteEvent,
  generateAuthUrl,
  getEventsInRange,
  handleOAuth2Callback,
  initGoogleCalendar,
  listCalendars,
  updateEvent,
} from "../services/google.calendar.service";

const router = express.Router();

initGoogleCalendar();
generateAuthUrl();

router.get("/events", async (req, res) => {
  
  const { start, end } = req.query;

  if (!Date.parse(start as string) || !Date.parse(end as string)) {
    return res.status(400).send("Invalid start or end date");
  }

  const startDate = new Date(start as string);
  const endDate = new Date(end as string);
  endDate.setHours(23, 59, 59, 999);

  const events = await getEventsInRange(startDate, endDate);
  res.json(events);
});

router.get("/free-slots", async (req, res) => {
  const { start, end, duration } = req.query;

  if (!Date.parse(start as string) || !Date.parse(end as string)) {
    return res.status(400).send("Invalid start or end date");
  }

  const startDate = new Date(start as string);
  const endDate = new Date(end as string);
  endDate.setHours(23, 59, 59, 999);

  const events = await getEventsInRange(startDate, endDate);
  const meetingDuration = duration ? parseInt(duration as string, 10) : 30;
  const freeSlots = events ? findFreeSlots(startDate, endDate, events, 15, meetingDuration) : [];

  res.json(freeSlots);
});

router.get("/calendars", async (req, res) => {
  try {
    const calendars = await listCalendars();
    res.json(calendars);
  } catch (error: any) {
    res.status(500).send((error as Error).message);
  }
});

router.post("/events", async (req, res) => {
  try {
    const event = await createEvent(req.body);
    res.json(event);
  } catch (error: any) {
    res.status(500).send((error as Error).message);
  }
});

router.put("/events/:id", async (req, res) => {
  try {
    const event = await updateEvent(req.params.id, req.body);
    res.json(event);
  } catch (error: any) {
    if (error.code === 404) {
      return res.status(404).send("Event not found");
    }
    res.status(500).send(error.message);
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    await deleteEvent(req.params.id);
    res.send("Event deleted successfully");
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

router.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (code) {
    try {
      const tokens = await handleOAuth2Callback(code as string);

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
