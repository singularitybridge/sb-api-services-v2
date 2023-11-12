# My Task Manager

This is a simple API service for managing tasks. It is built with Node.js, Express, and TypeScript.

## Features

- Add a task
- Get a list of tasks
- Get a task by ID
- Update task status
- Tasks are stored in memory

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js
- npm

### Installing

1. Clone the repository
```
git clone https://github.com/yourusername/my-task-manager.git
```

2. Navigate to the project directory
```
cd my-task-manager
```

3. Install dependencies
```
npm install
```

4. Start the server
```
npm start
```

The server will start running at `http://localhost:3000`.

## API Endpoints

- `POST /tasks`: Add a new task
- `GET /tasks`: Get a list of tasks
- `GET /tasks/:id`: Get a task by ID
- `PUT /tasks/:id`: Update task status

## Built With

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)

## License

This project is licensed under the MIT License.