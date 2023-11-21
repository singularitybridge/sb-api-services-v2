import moment from "moment-timezone";
import { IEvent } from "../Interfaces/event.interface";

export enum SlotStatus {
  Free = "free",
  Occupied = "occupied"
}

interface TimeSlot {
  start: Date;
  end: Date;
  status: SlotStatus;
}

export const generateTimeSlots = (
  startDate: Date,
  endDate: Date,
  startHour: number,
  endHour: number
): TimeSlot[] => {
  let slots: TimeSlot[] = [];
  let current = moment
    .tz(startDate, "Asia/Jerusalem")
    .startOf("day")
    .hour(startHour);
  let end = moment.tz(endDate, "Asia/Jerusalem").startOf("day").hour(endHour);

  while (current.isBefore(end)) {
    if (current.hour() >= startHour && current.hour() < endHour) {
      let slotStart = current.toDate();
      let slotEnd = current.clone().add(1, "hour").toDate();

      slots.push({ start: slotStart, end: slotEnd, status: SlotStatus.Free });
    }
    current.add(1, "hour");
  }

  return slots;
};

export const markOccupiedSlots = (slots: TimeSlot[], events: IEvent[]): TimeSlot[] => {
  events.forEach((event) => {
    let eventStart = moment(event.startDate);
    let eventEnd = moment(event.endDate);

    slots.forEach((slot) => {
      let slotStart = moment(slot.start);
      let slotEnd = moment(slot.end);

      if (slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart)) {
        slot.status = SlotStatus.Occupied;
      }
    });
  });

  return slots;
};

export const findFreeSlots = (
  startDate: Date,
  endDate: Date,
  events: IEvent[]
): { start: string; end: string }[] => {

  let allSlots = generateTimeSlots(startDate, endDate, 8, 17);
  let markedSlots = markOccupiedSlots(allSlots, events);

  return markedSlots
    .filter((slot) => slot.status === SlotStatus.Free)
    .map((slot) => ({
      start:
        slot.start.toLocaleDateString("en-GB", { timeZone: "Asia/Jerusalem" }) +
        ", " +
        slot.start.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jerusalem",
        }),
      end:
        slot.end.toLocaleDateString("en-GB", { timeZone: "Asia/Jerusalem" }) +
        ", " +
        slot.end.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jerusalem",
        }),
    }));
};
