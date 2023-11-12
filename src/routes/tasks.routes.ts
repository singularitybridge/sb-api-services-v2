import express from 'express';
import { TasksController } from '../controllers/tasks.controller';

const router = express.Router();
const tasksController = new TasksController();

router.post('/', (req, res) => tasksController.addTask(req, res));
router.get('/', (req, res) => tasksController.getTasks(res));
router.get('/:id', (req, res) => tasksController.getTaskById(req, res));
router.put('/:id', (req, res) => tasksController.updateTaskStatus(req, res));

export default router;