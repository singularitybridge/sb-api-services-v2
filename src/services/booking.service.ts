import {
  addMinutes,
  startOfDay,
  endOfDay,
  setHours,
  isBefore,
  isAfter,
  getHours,
  differenceInMinutes,
  format,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { IEvent, IFreeSlot } from '../Interfaces/event.interface';

export enum SlotStatus {
  Free = 'free',
  Occupied = 'occupied',
}

interface TimeSlot {
  start: Date;
  end: Date;
  status: SlotStatus;
}

const TIMEZONE = 'Asia/Jerusalem';

export const generateTimeSlots = (
  startDate: Date,
  endDate: Date,
  startHour: number,
  endHour: number,
  duration: number, // duration in minutes
): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  // Convert to timezone and set to start of day with startHour
  let current = setHours(
    startOfDay(toZonedTime(startDate, TIMEZONE)),
    startHour,
  );
  const end = setHours(endOfDay(toZonedTime(endDate, TIMEZONE)), endHour);

  while (isBefore(current, end)) {
    const slotStart = current;
    const slotEnd = addMinutes(current, duration);

    // Ensure the slot does not exceed the working hours
    const currentHour = getHours(current);
    if (currentHour >= startHour && currentHour < endHour) {
      slots.push({ start: slotStart, end: slotEnd, status: SlotStatus.Free });
    }
    current = addMinutes(current, duration);
  }

  return slots;
};

export const markOccupiedSlots = (
  slots: TimeSlot[],
  events: IEvent[],
): TimeSlot[] => {
  events.forEach((event) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);

    slots.forEach((slot) => {
      // Check for overlap: slot overlaps event if slot starts before event ends AND slot ends after event starts
      if (isBefore(slot.start, eventEnd) && isAfter(slot.end, eventStart)) {
        slot.status = SlotStatus.Occupied;
      }
    });
  });

  return slots;
};

export const isSlotAvailable = (
  slot: TimeSlot,
  meetingDuration: number,
  allSlots: TimeSlot[],
): boolean => {
  const endOfDesiredSlot = addMinutes(slot.start, meetingDuration);
  const relevantSlots = allSlots.filter(
    (s) =>
      !isBefore(s.start, slot.start) && // s.start >= slot.start (isSameOrAfter)
      !isAfter(s.end, endOfDesiredSlot), // s.end <= endOfDesiredSlot (isSameOrBefore)
  );

  // Calculate the total free duration within the relevant slots
  const totalFreeDuration = relevantSlots.reduce((acc, s) => {
    if (s.status === SlotStatus.Free) {
      return acc + differenceInMinutes(s.end, s.start);
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
  meetingDuration: number,
): IFreeSlot[] => {
  const allSlots = generateTimeSlots(startDate, endDate, 9, 17, slotDuration);
  const markedSlots = markOccupiedSlots(allSlots, events);

  const freeSlots: IFreeSlot[] = [];
  let lastAddedSlotEnd: Date | null = null;

  for (const slot of markedSlots) {
    if (
      slot.status === SlotStatus.Free &&
      isSlotAvailable(slot, meetingDuration, allSlots)
    ) {
      const slotStart = slot.start;
      const slotEnd = addMinutes(slot.start, meetingDuration);

      // Get the day name ('EEEE' is the date-fns equivalent of moment's 'dddd')
      const dayName = format(slotStart, 'EEEE');

      // Only add the slot if it's not overlapping with the previously added slot
      // isSameOrAfter = !isBefore
      if (!lastAddedSlotEnd || !isBefore(slotStart, lastAddedSlotEnd)) {
        freeSlots.push({
          start: format(slotStart, 'dd/MM/yyyy, HH:mm'),
          end: format(slotEnd, 'dd/MM/yyyy, HH:mm'),
          day: dayName,
        });
        lastAddedSlotEnd = slotEnd;
      }
    }
  }

  return freeSlots;
};
