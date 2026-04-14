export interface DeadLetterRecord {
  time: number;
  reason: string;
  payload: unknown;
}

export class DeadLetterQueue {
  private records: DeadLetterRecord[] = [];

  push(reason: string, payload: unknown): void {
    this.records.push({ time: Date.now(), reason, payload });
  }

  list(): DeadLetterRecord[] {
    return [...this.records];
  }
}
