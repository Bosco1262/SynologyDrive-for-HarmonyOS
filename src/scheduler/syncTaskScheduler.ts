export class SyncTaskScheduler {
  private paused = false;
  private queue: Array<() => Promise<void>> = [];
  private running = false;

  enqueue(task: () => Promise<void>): void {
    this.queue.push(task);
    void this.run();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    void this.run();
  }

  isPaused(): boolean {
    return this.paused;
  }

  private async run(): Promise<void> {
    if (this.running || this.paused) {
      return;
    }
    this.running = true;
    try {
      while (!this.paused) {
        const next = this.queue.shift();
        if (!next) {
          break;
        }
        await next();
      }
    } finally {
      this.running = false;
    }
  }
}
