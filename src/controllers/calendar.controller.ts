import { Request } from "express";
import {
  Controller,
  Route,
  Get,
  Query,
  Body,
  Post,
  Path,
  Put,
  Delete,
  SuccessResponse,
  Response,
  TsoaResponse,
} from "tsoa";

import moment from "moment-timezone";

import {
  createEvent,
  deleteEvent,
  getEventsInRange,
  handleOAuth2Callback,
  listCalendars,
  updateEvent,
} from "../services/google.calendar.service";
import { findFreeSlots } from "../services/booking.service";
import { IEvent, IEventCreationResponse, IEventResponse, IFreeSlot } from "../Interfaces/event.interface";
import { ICalendar } from "../Interfaces/calendar.interface";
import { IEventRequestBody } from "../Interfaces/eventRequest.interface";

@Route("calendar")
export class CalendarController extends Controller {
  @Get("events")
  @Response(400, "Invalid start or end date")
  public async getEvents(
    @Query() start: string,
    @Query() end: string
  ): Promise<IEventResponse[]> {
    if (!Date.parse(start) || !Date.parse(end)) {
      this.setStatus(400);
      throw new Error("Invalid start or end date");
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const events = await getEventsInRange(startDate, endDate);

    return events.map((event) => ({
      ...event,
      formattedStartDate: moment(event.startDate)
        .tz("Asia/Jerusalem")
        .format("DD/MM/YYYY, HH:mm"),
      formattedEndDate: moment(event.endDate)
        .tz("Asia/Jerusalem")
        .format("DD/MM/YYYY, HH:mm"),
      dayOfWeek: moment(event.startDate).tz("Asia/Jerusalem").format("dddd"),
    }));
  }

  @Get("free-slots")
  @Response(400, "Invalid start or end date")
  public async getFreeSlots(
    @Query() start: string,
    @Query() end: string,
    @Query() duration?: number
  ): Promise<IFreeSlot[]> {
    if (!Date.parse(start) || !Date.parse(end)) {
      this.setStatus(400);
      throw new Error("Invalid start or end date");
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const events = await getEventsInRange(startDate, endDate);
    const meetingDuration = duration ? parseInt(duration.toString(), 10) : 30;
    const freeSlots = findFreeSlots(
      startDate,
      endDate,
      events,
      15,
      meetingDuration
    );

    return freeSlots;
  }

  @Get('calendars')
  @Response(500, 'Server Error')
  public async getCalendars(): Promise<ICalendar[]> {
    try {
      const calendars = await listCalendars();
      return calendars;
    } catch (error: any) {
      this.setStatus(500);
      throw new Error((error as Error).message);
    }
  }

  @Post('events')
  @Response(500, 'Server Error')
  public async createEvent(
    @Body() eventData: IEventRequestBody
  ): Promise<IEventCreationResponse> {
    try {
      const response = await createEvent(eventData);
      return response;
    } catch (error: any) {
      this.setStatus(500);
      throw new Error((error as Error).message);
    }
  }

  @Put('events/{id}')
  @Response(404, 'Event not found')
  @Response(500, 'Server Error')
  public async updateEvent
(
    @Path() id: string,
    @Body() eventData: IEventRequestBody
  ): Promise<{ message: string }> {
    try {
      await updateEvent(id, eventData);
      return { message: "Event updated successfully" };
    } catch (error: any) {
      if (error.code === 404) {
        this.setStatus(404);
        throw new Error('Event not found');
      }
      this.setStatus(500);
      throw new Error('Internal Server Error');
    }
  }


  @Delete('events/{id}')
  @Response(404, 'Event not found')
  @Response(500, 'Server Error')
  public async deleteEvent(
    @Path() id: string
  ): Promise<{ message: string }> {
    try {
      await deleteEvent(id);
      return { message: "Event deleted successfully" };
    } catch (error: any) {
      if (error.code === 404) {
        this.setStatus(404);
        throw new Error('Event not found');
      }
      this.setStatus(500);
      throw new Error('Internal Server Error');
    }
  }


  @Get('oauth2callback')
  @Response(400, 'Bad Request')
  @Response(500, 'Error retrieving access token')
  public async handleOAuth2Callback(
    @Query() code?: string
  ): Promise<{ message: string }> {
    if (!code) {
      this.setStatus(400);
      throw new Error('Bad Request: No code provided');
    }

    try {
      await handleOAuth2Callback(code);
      return { message: "Authentication successful! You can close this tab." };
    } catch (error: any) {
      this.setStatus(500);
      throw new Error('Error retrieving access token');
    }
  }




}
