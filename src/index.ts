import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { startAgenda } from './services/agenda/agenda.service';

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(() => {
    console.log('Successfully connected to MongoDB');
    startAgenda();
  })
  .catch((error) => console.error('Connection error', error));

import express from 'express';
import { RegisterRoutes } from './routes/routes';
import {
  generateAuthUrl,
  initGoogleCalendar,
} from './services/google.calendar.service';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../build/swagger.json';
import cors from 'cors';

import policyRouter from './routes/policy.routes';

import ttsRouter from './routes/tts.routes'; // Import the missing ttsRouter module
import sttRouter from './routes/stt.routes'; // Import the missing sttRouter module
import { twilioVoiceRouter } from './routes/twilio/voice.routes';
import { twilioMessagingRouter } from './routes/twilio/messaging.routes';


const app = express();
const port = process.env.PORT || 3000;

initGoogleCalendar();
generateAuthUrl();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

RegisterRoutes(app);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/policy', policyRouter);

// app.use("/messaging", messagingRouter);

app.use('/twilio/voice', twilioVoiceRouter);
app.use('/twilio/messaging', twilioMessagingRouter);

app.use('/tts', ttsRouter);
app.use('/stt', sttRouter);

app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
