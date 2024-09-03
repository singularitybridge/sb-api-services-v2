class Logger {
  private logs: string[] = [];

  log(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    this.logs.push(message);
    console.log(message);
  }

  error(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    this.logs.push(`ERROR: ${message}`);
    console.error(message);
  }

  getLogs() {
    return this.logs.join('\n');
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();