import { Task } from '../models/task.model';
import { generateGuid } from '../utils/guid.util';
import { TaskStatus } from '../types/task.type';
class TasksService {
  private tasks: Task[] = [];

  createTask(name: string, project: string, description: string, eta: Date, status: TaskStatus = 'todo'): Task {
    const task = new Task(generateGuid(), name, project, description, eta, status);
    this.tasks.push(task);
    return task;
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  getTaskById(id: string): Task | undefined {
    return this.tasks.find(task => task.id === id);
  }

  updateTaskStatus(id: string, status: TaskStatus): Task | undefined {
    const task = this.getTaskById(id);
    if (task) {
      task.status = status;
    }
    return task;
  }
}

export const tasksService = new TasksService();