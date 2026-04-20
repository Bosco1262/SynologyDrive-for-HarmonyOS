import { MetadataStore } from "../storage/metadataStore";
import { SyncTaskScheduler } from "./syncTaskScheduler";

export class SyncLifecycleCoordinator {
  constructor(
    private readonly scheduler: SyncTaskScheduler,
    private readonly metadata: MetadataStore,
  ) {}

  onAppLifecycle(state: "foreground" | "background"): void {
    this.scheduler.onLifecycleChanged(state);
    this.saveCheckpoint();
    if (state === "foreground") {
      this.restoreCheckpoint();
    }
  }

  saveCheckpoint(): void {
    this.metadata.setSchedulerCheckpoint(this.scheduler.checkpoint());
  }

  restoreCheckpoint(): void {
    const checkpoint = this.metadata.getSchedulerCheckpoint();
    if (!checkpoint) {
      return;
    }
    this.scheduler.restore(checkpoint);
  }
}
