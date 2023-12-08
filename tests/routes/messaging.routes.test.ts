// FILEPATH: /Users/aviosipov/dev/sb/sb-api-services-v2/api-v2/tests/routes/messaging.routes.test.ts

import request from "supertest";
import app from "../../src/index";

describe("POST /voice", () => {
    it("should handle a voice call", async () => {
        const mockCallData = {
            CallStatus: "ringing",
            From: "+972526722216",
            To: "+97293762075",
        };

        const response = await request(app)
            .post("/messaging/voice")
            .send(mockCallData)
            .expect(200);

        // Add additional assertions based on your expected response
        // For example, if you expect the response to be a JSON object with a 'status' property:
        // expect(response.body).toHaveProperty('status');
    });

    // Additional test cases...
});


