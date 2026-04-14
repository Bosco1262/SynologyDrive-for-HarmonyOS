import { NotificationCenter } from "../notification/notificationCenter";
import { MetadataStore } from "../storage/metadataStore";
import { SyncLifecycleCoordinator } from "./syncLifecycleCoordinator";
import { SyncTaskScheduler } from "./syncTaskScheduler";

export type AppLifecycleState = "foreground" | "background";

export interface HarmonyLifecycleBridge {
  subscribe(listener: (state: AppLifecycleState) => void): () => void;
}

export class InMemoryHarmonyLifecycleBridge implements HarmonyLifecycleBridge {
  private listeners = new Set<(state: AppLifecycleState) => void>();

  subscribe(listener: (state: AppLifecycleState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(state: AppLifecycleState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export class SyncHarmonyCoordinator {
  private readonly lifecycleCoordinator: SyncLifecycleCoordinator;
  private unsubscribe: (() => void) | undefined;

  constructor(
    scheduler: SyncTaskScheduler,
    metadata: MetadataStore,
    private readonly lifecycle: HarmonyLifecycleBridge,
    private readonly notifications?: NotificationCenter,
  ) {
    this.lifecycleCoordinator = new SyncLifecycleCoordinator(scheduler, metadata);
  }

  start(): void {
    this.unsubscribe = this.lifecycle.subscribe((state) => {
      this.lifecycleCoordinator.onAppLifecycle(state);
      if (state === "background") {
        this.notifications?.notify("同步任务已暂停", "应用切到后台，任务检查点已保存", "info");
      } else {
        this.notifications?.notify("同步任务已恢复", "应用回到前台，任务恢复执行", "info");
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
