import { IEvent } from "../../src/Interfaces/event.interface";
import {
  SlotStatus,
  findFreeSlots,
  generateTimeSlots,
  markOccupiedSlots,
} from "../../src/services/booking.service";
import moment from "moment-timezone";

describe("generateTimeSlots", () => {
  it("should generate correct number of slots", () => {
    const startDate = new Date(2022, 1, 1, 8, 0, 0);
    const endDate = new Date(2022, 1, 1, 17, 0, 0);
    const slots = generateTimeSlots(startDate, endDate, 8, 17);
    expect(slots.length).toEqual(9);
  });

  it("should generate slots with correct start and end times", () => {
    const startDate = new Date(2022, 1, 1, 8, 0, 0);
    const endDate = new Date(2022, 1, 1, 17, 0, 0);
    const slots = generateTimeSlots(startDate, endDate, 8, 17);
    slots.forEach((slot, index) => {
      const expectedStart = moment
        .tz(startDate, "Asia/Jerusalem")
        .startOf("day")
        .hour(8 + index)
        .toDate();
      const expectedEnd = moment
        .tz(startDate, "Asia/Jerusalem")
        .startOf("day")
        .hour(8 + index + 1)
        .toDate();
      expect(slot.start).toEqual(expectedStart);
      expect(slot.end).toEqual(expectedEnd);
    });
  });
});

describe("markOccupiedSlots", () => {
  it("should mark slots as occupied correctly", () => {
    
    const startDate = new Date(2022, 1, 1, 8, 0, 0);
    const endDate = new Date(2022, 1, 1, 17, 0, 0);

    const slots = generateTimeSlots(startDate, endDate, 8, 17);
    
    const events: IEvent[] = [
      {
        id: "1",
        title: "Meeting",
        description: "Team meeting",
        startDate: new Date(2022, 1, 1, 10, 0, 0),
        endDate: new Date(2022, 1, 1, 11, 0, 0)
      },
      {
        id: "2",
        title: "Lunch Break",
        description: "Lunch time",
        startDate: new Date(2022, 1, 1, 13, 0, 0),
        endDate: new Date(2022, 1, 1, 14, 0, 0)
      }
    ];

    const updatedSlots = markOccupiedSlots(slots, events);

    updatedSlots.forEach((slot) => {
      const slotStart = moment(slot.start);
      const isOccupied = events.some(event => 
        slotStart.isSameOrAfter(moment(event.startDate)) && 
        slotStart.isBefore(moment(event.endDate))
      );
    
      expect(slot.status).toBe(
        isOccupied ? SlotStatus.Occupied : SlotStatus.Free
      );
    });
    


  });

});


describe('findFreeSlots', () => {
  it('should find free slots correctly', () => {
    const startDate = moment.tz('2022-01-01 08:00:00', 'Asia/Jerusalem').toDate();
    const endDate = moment.tz('2022-01-01 17:00:00', 'Asia/Jerusalem').toDate();

    const events: IEvent[] = [
      {
        id: '1',
        title: 'Meeting',
        description: 'Team meeting',
        startDate: moment.tz('2022-01-01 10:00:00', 'Asia/Jerusalem').toDate(),
        endDate: moment.tz('2022-01-01 11:00:00', 'Asia/Jerusalem').toDate(),
      },
      {
        id: '2',
        title: 'Lunch Break',
        description: 'Lunch time',
        startDate: moment.tz('2022-01-01 13:00:00', 'Asia/Jerusalem').toDate(),
        endDate: moment.tz('2022-01-01 14:00:00', 'Asia/Jerusalem').toDate(),
      },
    ];

    const freeSlots = findFreeSlots(startDate, endDate, events);

    // Add your expectations here...
    // For example, you can check the number of free slots:
    expect(freeSlots.length).toEqual(6);

    // Or you can check the start and end times of the first free slot:
    expect(freeSlots[0].start).toEqual('01/01/2022, 09:00');
    expect(freeSlots[0].end).toEqual('01/01/2022, 10:00');
  });
});