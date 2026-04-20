export type LogLevel = "info" | "warn" | "error";

export interface LogRecord {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface TaskLogger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  list(): LogRecord[];
}

export class InMemoryTaskLogger implements TaskLogger {
  private readonly records: LogRecord[] = [];

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const record: LogRecord = {
      timestamp: Date.now(),
      level,
      message,
    };
    if (context) {
      record.context = context;
    }
    this.records.push(record);
  }

  list(): LogRecord[] {
    return [...this.records];
  }
}
