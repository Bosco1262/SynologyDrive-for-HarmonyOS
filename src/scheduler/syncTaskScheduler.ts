import { SchedulerCheckpoint } from "../types";

interface ScheduledTask {
  id: string;
  run: () => Promise<void>;
}

export class SyncTaskScheduler {
  private paused = false;
  private queue: ScheduledTask[] = [];
  private handlers = new Map<string, () => Promise<void>>();
  private running = false;

  enqueue(task: () => Promise<void>): void {
    const id = `anonymous-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.queue.push({ id, run: task });
    void this.run();
  }

  registerTask(taskId: string, task: () => Promise<void>): void {
    this.handlers.set(taskId, task);
  }

  enqueueById(taskId: string): void {
    const task = this.handlers.get(taskId);
    if (!task) {
      throw new Error(`task not registered: ${taskId}`);
    }
    this.queue.push({ id: taskId, run: task });
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

  onLifecycleChanged(state: "foreground" | "background"): void {
    if (state === "background") {
      this.pause();
      return;
    }
    this.resume();
  }

  checkpoint(): SchedulerCheckpoint {
    return {
      paused: this.paused,
      queuedTaskIds: this.queue.map((task) => task.id),
    };
  }

  restore(checkpoint: SchedulerCheckpoint): void {
    this.paused = checkpoint.paused;
    this.queue = checkpoint.queuedTaskIds
      .map((taskId) => {
        const task = this.handlers.get(taskId);
        if (!task) {
          return undefined;
        }
        return { id: taskId, run: task };
      })
      .filter((task): task is ScheduledTask => Boolean(task));
    if (!this.paused) {
      void this.run();
    }
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
        await next.run();
      }
    } finally {
      this.running = false;
    }
  }
}
