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
  endHour: number,
  duration: number // duration in minutes
): TimeSlot[] => {
  let slots: TimeSlot[] = [];
  let current = moment
    .tz(startDate, "Asia/Jerusalem")
    .startOf("day")
    .hour(startHour);

  let end = moment.tz(endDate, "Asia/Jerusalem").endOf("day").hour(endHour);

  while (current.isBefore(end)) {
    let slotStart = current.toDate();
    let slotEnd = current.clone().add(duration, "minutes").toDate();

    // Ensure the slot does not exceed the working hours
    if (current.hour() >= startHour && current.hour() < endHour) {
      slots.push({ start: slotStart, end: slotEnd, status: SlotStatus.Free });
    }
    current.add(duration, "minutes");
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

export const isSlotAvailable = (slot: TimeSlot, meetingDuration: number, allSlots: TimeSlot[]): boolean => {
  let endOfDesiredSlot = moment(slot.start).add(meetingDuration, 'minutes');
  let relevantSlots = allSlots.filter(s => 
    moment(s.start).isSameOrAfter(slot.start) && 
    moment(s.end).isSameOrBefore(endOfDesiredSlot)
  );

  // Calculate the total free duration within the relevant slots
  let totalFreeDuration = relevantSlots.reduce((acc, s) => {
    if (s.status === SlotStatus.Free) {
      return acc + moment(s.end).diff(moment(s.start), 'minutes');
    }
    return acc;
  }, 0);

  return totalFreeDuration >= meetingDuration;
};

export const findFreeSlots = (
  startDate: Date,
  endDate: Date,
  events: IEvent[],
  slotDuration: number,
  meetingDuration: number
): { start: string; end: string }[] => {

  let allSlots = generateTimeSlots(startDate, endDate, 9, 17, slotDuration);
  let markedSlots = markOccupiedSlots(allSlots, events);

  let freeSlots: { start: string; end: string }[] = [];
  let lastAddedSlotEnd = null;

  for (let slot of markedSlots) {
    if (slot.status === SlotStatus.Free && isSlotAvailable(slot, meetingDuration, allSlots)) {
      let slotStartMoment = moment(slot.start);
      let slotEndMoment = moment(slot.start).add(meetingDuration, 'minutes');

      // Only add the slot if it's not overlapping with the previously added slot
      if (!lastAddedSlotEnd || slotStartMoment.isSameOrAfter(lastAddedSlotEnd)) {
        freeSlots.push({
          start: slotStartMoment.format('DD/MM/YYYY, HH:mm'),
          end: slotEndMoment.format('DD/MM/YYYY, HH:mm')
        });
        lastAddedSlotEnd = slotEndMoment;
      }
    }
  }

  return freeSlots;
};



