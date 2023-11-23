import { Request, Response } from "express";
import moment from "moment-timezone";

import { createEvent, deleteEvent, getEventsInRange, handleOAuth2Callback, listCalendars, updateEvent } from "../services/google.calendar.service";
import { findFreeSlots } from "../services/booking.service";

export class CalendarController {
  async getEvents(req: Request, res: Response) {
    const { start, end } = req.query;

    if (!Date.parse(start as string) || !Date.parse(end as string)) {
      return res.status(400).send("Invalid start or end date");
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    endDate.setHours(23, 59, 59, 999);

    const events = await getEventsInRange(startDate, endDate);
    res.json(
      events.map((event) => ({
        ...event,
        startDate: moment(event.startDate)
          .tz("Asia/Jerusalem")
          .format("DD/MM/YYYY, HH:mm"),
        endDate: moment(event.endDate)
          .tz("Asia/Jerusalem")
          .format("DD/MM/YYYY, HH:mm"),
        day: moment(event.startDate).tz("Asia/Jerusalem").format("dddd"),
      }))
    );
  }

  async getFreeSlots(req: Request, res: Response) {
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
  }

  async getCalendars(req: Request, res: Response) {
    try {
        const calendars = await listCalendars();
        res.json(calendars);
      } catch (error: any) {
        res.status(500).send((error as Error).message);
      }
  }

  async createEvent(req: Request, res: Response) {
    try {
        const event = await createEvent(req.body);
        res.json(event);
      } catch (error: any) {
        res.status(500).send((error as Error).message);
      }
    
  }

  async updateEvent(req: Request, res: Response) {
    try {
        const event = await updateEvent(req.params.id, req.body);
        res.json(event);
      } catch (error: any) {
        if (error.code === 404) {
          return res.status(404).send("Event not found");
        }
        res.status(500).send(error.message);
      }
  }

  async deleteEvent(req: Request, res: Response) {
    try {
        await deleteEvent(req.params.id);
        res.send("Event deleted successfully");
      } catch (error: any) {
        res.status(500).send(error.message);
      }
    
  }

  async handleOAuth2Callback(req: Request, res: Response) {
    const { code } = req.query;

    if (code) {
      try {
        await handleOAuth2Callback(code as string);
        res.send("Authentication successful! You can close this tab.");
      } catch (error) {
        res.send("Error retrieving access token");
      }
    }
  }
}
