import request from "supertest";
import app from "../../src/index";

jest.mock("../../src/services/google.calendar.service", () => ({
  initGoogleCalendar: jest.fn(),
  generateAuthUrl: jest.fn(),
  getEventsInRange: jest.fn().mockResolvedValue([
    /* array of mock events */
  ]),
}));

describe("GET /free-slots", () => {
  it("should return a list of free slots", async () => {
    const startDate = new Date(2022, 1, 1).toISOString();
    const endDate = new Date(2022, 1, 2).toISOString();

    const response = await request(app)
      .get(`/calendar/free-slots?start=${startDate}&end=${endDate}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    // Add more assertions based on the expected structure of free slots
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
