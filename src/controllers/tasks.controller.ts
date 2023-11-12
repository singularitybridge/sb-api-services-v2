import { Request, Response } from 'express';
import { tasksService } from '../services/tasks.service';
import { Task } from '../models/task.model';

export class TasksController {

  public addTask = (req: Request, res: Response): void => {
    const task: Task = req.body;
    const newTask = tasksService.createTask(task.name, task.project, task.description, task.eta, task.status);
    res.status(201).json(newTask);
  };
  public getTasks = (res: Response): void => {
    const tasks = tasksService.getTasks();
    res.status(200).json(tasks);
  };

  public getTaskById = (req: Request, res: Response): void => {
    const taskId = req.params.id;
    const task = tasksService.getTaskById(taskId);
    if (task) {
      res.status(200).json(task);
    } else {
      res.status(404).json({ message: 'Task not found' });
    }
  };

  public updateTaskStatus = (req: Request, res: Response): void => {
    const taskId = req.params.id;
    const status = req.body.status;
    const updatedTask = tasksService.updateTaskStatus(taskId, status);
    if (updatedTask) {
      res.status(200).json(updatedTask);
    } else {
      res.status(404).json({ message: 'Task not found' });
    }
  };
}