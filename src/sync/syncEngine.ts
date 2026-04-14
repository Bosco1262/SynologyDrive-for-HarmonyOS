import { DriveApiGateway } from "../api/driveApiGateway";
import { EventBus } from "../core/eventBus";
import { NotificationCenter } from "../notification/notificationCenter";
import { TaskLogger } from "../observability/taskLogger";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { RetryPolicy, withRetry } from "../reliability/retry";
import { MetadataStore } from "../storage/metadataStore";
import { DriveEntry } from "../types";
import { ConflictResolver } from "./conflictResolver";
import { ChunkTransferManager } from "./chunkTransfer";
import { SelectiveSyncPolicy } from "./selectiveSyncPolicy";
import { FixedRateSpeedLimiter, SpeedLimiter } from "./speedLimiter";

const clone = (entry: DriveEntry): DriveEntry => ({ ...entry });

export interface SyncEngineDeps {
  api: DriveApiGateway;
  metadata: MetadataStore;
  conflictResolver: ConflictResolver;
  events: EventBus;
  deadLetters: DeadLetterQueue;
  retryPolicy: RetryPolicy;
  selectiveSync?: SelectiveSyncPolicy;
  speedLimiter?: SpeedLimiter;
  chunkTransfer?: ChunkTransferManager;
  logger?: TaskLogger;
  notifications?: NotificationCenter;
}

export class SyncEngine {
  private readonly selectiveSync: SelectiveSyncPolicy;
  private readonly speedLimiter: SpeedLimiter;
  private readonly chunkTransfer: ChunkTransferManager;

  constructor(private readonly deps: SyncEngineDeps) {
    this.selectiveSync = deps.selectiveSync ?? new SelectiveSyncPolicy();
    this.speedLimiter = deps.speedLimiter ?? new FixedRateSpeedLimiter();
    this.chunkTransfer = deps.chunkTransfer ?? new ChunkTransferManager();
  }

  async initializeLocal(entries: DriveEntry[]): Promise<void> {
    this.deps.metadata.setLocalEntries(entries);
    this.deps.metadata.setLastSyncedEntries([]);
  }

  async runFullSync(): Promise<void> {
    await this.syncWithRetry(async () => {
      this.deps.events.emit("sync:start", { mode: "full" });
      this.deps.logger?.log("info", "sync started", { mode: "full" });
      this.deps.notifications?.notify("同步开始", "正在执行全量同步", "info");
      const cursor = this.deps.metadata.getCursor();
      const remote = await this.deps.api.listEntries(cursor);
      const localSnapshot = this.deps.metadata.getLocalSnapshot();
      const localMap = new Map(localSnapshot.entries);

      for (const remoteEntry of remote.entries) {
        if (!this.selectiveSync.allows(remoteEntry.path)) {
          continue;
        }
        const local = localMap.get(remoteEntry.path);
        if (!local) {
          if (!remoteEntry.deleted) {
            localMap.set(remoteEntry.path, clone(remoteEntry));
          }
          continue;
        }
        await this.reconcilePair(localMap, local, remoteEntry);
      }

      for (const [path, localEntry] of localMap) {
        if (!this.selectiveSync.allows(path)) {
          continue;
        }
        const hasRemote = remote.entries.some((entry) => entry.path === path && !entry.deleted);
        if (!hasRemote && !localEntry.deleted) {
          await this.throttledUpsert(clone(localEntry));
        }
      }

      this.deps.metadata.setLocalEntries(localMap.values());
      this.deps.metadata.setLastSyncedEntries(localMap.values());
      this.deps.metadata.updateCursor(remote.cursor);
      this.deps.events.emit("sync:success", { mode: "full" });
      this.deps.logger?.log("info", "sync finished", { mode: "full" });
      this.deps.notifications?.notify("同步完成", "全量同步已完成", "info");
    });
  }

  async runIncrementalSync(localChanges: DriveEntry[]): Promise<void> {
    await this.syncWithRetry(async () => {
      this.deps.events.emit("sync:start", { mode: "incremental" });
      this.deps.logger?.log("info", "sync started", { mode: "incremental" });
      this.deps.notifications?.notify("同步开始", "正在执行增量同步", "info");
      for (const change of localChanges) {
        if (!this.selectiveSync.allows(change.path)) {
          continue;
        }
        if (change.deleted) {
          this.deps.metadata.deleteLocalEntry(change.path);
          await this.throttledDelete(change.path, change.size ?? 0);
          continue;
        }
        this.deps.metadata.upsertLocalEntry(change);
        await this.throttledUpsert(change);
      }

      const remote = await this.deps.api.listEntries(this.deps.metadata.getCursor());
      for (const remoteEntry of remote.entries) {
        if (!this.selectiveSync.allows(remoteEntry.path)) {
          continue;
        }
        if (remoteEntry.deleted) {
          this.deps.metadata.deleteLocalEntry(remoteEntry.path);
        } else {
          this.deps.metadata.upsertLocalEntry(remoteEntry);
        }
      }
      this.deps.metadata.updateCursor(remote.cursor);
      this.deps.metadata.setLastSyncedEntries(this.deps.metadata.getLocalSnapshot().entries.values());
      this.deps.events.emit("sync:success", { mode: "incremental" });
      this.deps.logger?.log("info", "sync finished", { mode: "incremental" });
      this.deps.notifications?.notify("同步完成", "增量同步已完成", "info");
    });
  }

  private async reconcilePair(
    localMap: Map<string, DriveEntry>,
    local: DriveEntry,
    remote: DriveEntry,
  ): Promise<void> {
    if (remote.deleted) {
      localMap.delete(local.path);
      return;
    }
    if (local.contentHash === remote.contentHash && local.deleted === remote.deleted) {
      return;
    }
    const decision = this.deps.conflictResolver.decide(local, remote);
    if (decision === "useLocal") {
      await this.throttledUpsert(local);
      return;
    }
    if (decision === "useRemote") {
      const downloadedRemote = await this.chunkTransfer.download(this.deps.api, remote);
      localMap.set(downloadedRemote.path, clone(downloadedRemote));
      return;
    }
    const conflictedPath = `${local.path}.conflict.${Date.now()}`;
    localMap.set(conflictedPath, {
      ...clone(local),
      path: conflictedPath,
      version: local.version + 1,
      modifiedAt: Date.now(),
    });
    localMap.set(remote.path, clone(remote));
  }

  private async syncWithRetry(action: () => Promise<void>): Promise<void> {
    try {
      await withRetry(action, this.deps.retryPolicy);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown sync failure";
      this.deps.deadLetters.push(message, {});
      this.deps.events.emit("sync:error", { message });
      this.deps.logger?.log("error", "sync failed", { message });
      this.deps.notifications?.notify("同步失败", message, "error");
      throw error;
    }
  }

  private async throttledUpsert(entry: DriveEntry): Promise<void> {
    await this.speedLimiter.throttle(entry.size ?? 0);
    await this.chunkTransfer.upload(this.deps.api, entry);
  }

  private async throttledDelete(path: string, bytes: number): Promise<void> {
    await this.speedLimiter.throttle(bytes);
    await this.deps.api.deleteEntry(path);
  }
}
