import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import { RegisterRoutes } from './routes/routes';
import { generateAuthUrl, initGoogleCalendar } from './services/google.calendar.service';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../build/swagger.json';
import cors from 'cors';
import policyRouter from './routes/policy.routes';

const app = express();
const port = process.env.PORT || 3000;

initGoogleCalendar();
generateAuthUrl();


app.use(express.json());
app.use(cors());


// Use the generated routes
RegisterRoutes(app);

// Set up Swagger UI to serve the API documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/policy', policyRouter);

// serve the swaggerDocument
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
