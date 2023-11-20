import moment from "moment-timezone";

export interface Slot {
  start: Date;
  end: Date;
  status: string;
}

export const generateTimeSlots = (startDate: Date, endDate: Date) => {
  let slots = [];
  let current = moment.tz(startDate, "Asia/Jerusalem").startOf("day").hour(9);
  let end = moment.tz(endDate, "Asia/Jerusalem").startOf("day").hour(17);

  while (current.isBefore(end)) {
    if (current.hour() >= 9 && current.hour() < 17) {
      let slotStart = current.toDate();
      let slotEnd = current.clone().add(1, "hour").toDate();

      slots.push({ start: slotStart, end: slotEnd, status: "free" });
    }
    current.add(1, "hour");
  }

  return slots;
};

export const markOccupiedSlots = (slots: Slot[], events: any[]) => {
  events.forEach((event) => {
    let eventStart = moment(event.startDate);
    let eventEnd = moment(event.endDate);

    slots.forEach((slot) => {
      let slotStart = moment(slot.start);
      let slotEnd = moment(slot.end);

      if (slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart)) {
        slot.status = "occupied";
      }
    });
  });

  return slots;
};

export const findFreeSlots = (
  startDate: Date,
  endDate: Date,
  events: any[]
) => {
  let allSlots = generateTimeSlots(startDate, endDate);

  console.log(" ------------------ allSlots ------------------ ");
  console.log(allSlots);

  let markedSlots = markOccupiedSlots(allSlots, events);

  console.log(" ------------------ markedSlots ------------------ ");
  console.log(markedSlots);

  return markedSlots
    .filter((slot) => slot.status === "free")
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
