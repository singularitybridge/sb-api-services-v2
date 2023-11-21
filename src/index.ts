import express from 'express';
import tasksRouter from './routes/tasks.routes';
import policyRouter from './routes/policy.routes';
import worldRouter from './routes/world.routes';
import calendarRouter from './routes/calendar.routes';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/', policyRouter);
app.use('/world_status', worldRouter);
app.use('/tasks', tasksRouter);
app.use('/calendar', calendarRouter);

// Export the app for testing
export default app;

// Separate the listening part to allow the app to be used in tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
