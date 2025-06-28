import moment from 'moment-timezone';
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

export const generateTimeSlots = (
  startDate: Date,
  endDate: Date,
  startHour: number,
  endHour: number,
  duration: number, // duration in minutes
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const current = moment
    .tz(startDate, 'Asia/Jerusalem')
    .startOf('day')
    .hour(startHour);

  const end = moment.tz(endDate, 'Asia/Jerusalem').endOf('day').hour(endHour);

  while (current.isBefore(end)) {
    const slotStart = current.toDate();
    const slotEnd = current.clone().add(duration, 'minutes').toDate();

    // Ensure the slot does not exceed the working hours
    if (current.hour() >= startHour && current.hour() < endHour) {
      slots.push({ start: slotStart, end: slotEnd, status: SlotStatus.Free });
    }
    current.add(duration, 'minutes');
  }

  return slots;
};

export const markOccupiedSlots = (
  slots: TimeSlot[],
  events: IEvent[],
): TimeSlot[] => {
  events.forEach((event) => {
    const eventStart = moment(event.startDate);
    const eventEnd = moment(event.endDate);

    slots.forEach((slot) => {
      const slotStart = moment(slot.start);
      const slotEnd = moment(slot.end);

      if (slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart)) {
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
  const endOfDesiredSlot = moment(slot.start).add(meetingDuration, 'minutes');
  const relevantSlots = allSlots.filter(
    (s) =>
      moment(s.start).isSameOrAfter(slot.start) &&
      moment(s.end).isSameOrBefore(endOfDesiredSlot),
  );

  // Calculate the total free duration within the relevant slots
  const totalFreeDuration = relevantSlots.reduce((acc, s) => {
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
  meetingDuration: number,
): IFreeSlot[] => {
  const allSlots = generateTimeSlots(startDate, endDate, 9, 17, slotDuration);
  const markedSlots = markOccupiedSlots(allSlots, events);

  const freeSlots: IFreeSlot[] = [];
  let lastAddedSlotEnd = null;

  for (const slot of markedSlots) {
    if (
      slot.status === SlotStatus.Free &&
      isSlotAvailable(slot, meetingDuration, allSlots)
    ) {
      const slotStartMoment = moment(slot.start);
      const slotEndMoment = moment(slot.start).add(meetingDuration, 'minutes');

      // Get the day name
      const dayName = slotStartMoment.format('dddd'); // 'dddd' formats the date to full day name

      // Only add the slot if it's not overlapping with the previously added slot
      if (
        !lastAddedSlotEnd ||
        slotStartMoment.isSameOrAfter(lastAddedSlotEnd)
      ) {
        freeSlots.push({
          start: slotStartMoment.format('DD/MM/YYYY, HH:mm'),
          end: slotEndMoment.format('DD/MM/YYYY, HH:mm'),
          day: dayName, // Add the day name here
        });
        lastAddedSlotEnd = slotEndMoment;
      }
    }
  }

  return freeSlots;
};
