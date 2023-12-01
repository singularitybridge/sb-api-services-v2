import express from 'express';
import { Twilio } from "twilio";

const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const router = express.Router();


// get messaegs history from twilio and send it to the client

router.get('/sms', (req, res) => {

    twilioClient.messages
        .list()
        .then(messages => res.send(messages))

});

router.post('/sms/reply', (req, res) => {

    // print recived message
    console.log(req.body);

    const replyTo = req.body.From; // Get the number that sent the WhatsApp message
    const messageText = req.body.Body; // Get the message text sent
    
    twilioClient.messages
        .create({
            body: `You said: ${messageText}`,
            from: `whatsapp:${twilioPhoneNumber}`,
            to: replyTo
        })
        .then(message => console.log(message.sid))

});

export default router;