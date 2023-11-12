import { TaskStatus } from '../types/task.type';

export class Task {
    id: string;
    name: string;
    project: string;
    description: string;
    eta: Date;
    status: TaskStatus;

    constructor(id: string, name: string, project: string, description: string, eta: Date, status: TaskStatus = 'todo') {
        this.id = id;
        this.name = name;
        this.project = project;
        this.description = description;
        this.eta = eta;
        this.status = status;
    }
}