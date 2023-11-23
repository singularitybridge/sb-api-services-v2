import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { CalendarController } from "../controllers/calendar.controller";

const router = express.Router();
const calendarController = new CalendarController();

router.get('/events', (req, res) => calendarController.getEvents(req, res));
router.get("/free-slots", (req, res) => calendarController.getFreeSlots(req, res));
router.get("/calendars", (req, res) => calendarController.getCalendars(req, res));
router.post("/events", (req, res) => calendarController.createEvent(req, res));
router.put("/events/:id", (req, res) => calendarController.updateEvent(req, res));
router.delete("/events/:id", (req, res) => calendarController.deleteEvent(req, res));
router.get("/oauth2callback", (req,res) => calendarController.handleOAuth2Callback(req, res));

export default router;
