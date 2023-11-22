import request from "supertest";
import app from "../../src/index";

jest.mock("../../src/services/google.calendar.service", () => ({
  initGoogleCalendar: jest.fn(),
  generateAuthUrl: jest.fn(),
  getEventsInRange: jest.fn().mockResolvedValue([
    {
      id: "6h7kidga64h10m435g3ogshbgu",
      title: "dental course",
      description: "",
      startDate: new Date("2023-11-19T09:30:00.000Z"),
      endDate: new Date("2023-11-19T10:15:00.000Z"),
    },
    {
      id: "ci1vfdj1sj317q9g240ctmp47g",
      title: "Dental Check-up",
      description: "Dental appointment",
      startDate: new Date("2023-11-20T07:15:00.000Z"),
      endDate: new Date("2023-11-20T19:00:00.000Z"),
    },
  ]),
}));

describe("GET /free-slots", () => {
  it("should return a list of free slots", async () => {
    const startDate = "2023-11-19"
    const endDate = "2023-11-19"

    const response = await request(app)
      .get(`/calendar/free-slots?start=${startDate}&end=${endDate}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(14);
  });

  it("should handle invalid dates", async () => {
    const invalidStartDate = "invalid-date";
    const invalidEndDate = "invalid-date";

    await request(app)
      .get(
        `/calendar/free-slots?start=${invalidStartDate}&end=${invalidEndDate}`
      )
      .expect(400);
  });

  // Additional test cases...
});
