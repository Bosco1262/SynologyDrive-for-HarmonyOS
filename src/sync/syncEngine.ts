import { DriveApiGateway } from "../api/driveApiGateway";
import { EventBus } from "../core/eventBus";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { RetryPolicy, withRetry } from "../reliability/retry";
import { MetadataStore } from "../storage/metadataStore";
import { DriveEntry } from "../types";
import { ConflictResolver } from "./conflictResolver";

const clone = (entry: DriveEntry): DriveEntry => ({ ...entry });

export interface SyncEngineDeps {
  api: DriveApiGateway;
  metadata: MetadataStore;
  conflictResolver: ConflictResolver;
  events: EventBus;
  deadLetters: DeadLetterQueue;
  retryPolicy: RetryPolicy;
}

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDeps) {}

  async initializeLocal(entries: DriveEntry[]): Promise<void> {
    this.deps.metadata.setLocalEntries(entries);
    this.deps.metadata.setLastSyncedEntries([]);
  }

  async runFullSync(): Promise<void> {
    await this.syncWithRetry(async () => {
      this.deps.events.emit("sync:start", { mode: "full" });
      const cursor = this.deps.metadata.getCursor();
      const remote = await this.deps.api.listEntries(cursor);
      const localSnapshot = this.deps.metadata.getLocalSnapshot();
      const localMap = new Map(localSnapshot.entries);

      for (const remoteEntry of remote.entries) {
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
        const hasRemote = remote.entries.some((entry) => entry.path === path && !entry.deleted);
        if (!hasRemote && !localEntry.deleted) {
          await this.deps.api.upsertEntry(clone(localEntry));
        }
      }

      this.deps.metadata.setLocalEntries(localMap.values());
      this.deps.metadata.setLastSyncedEntries(localMap.values());
      this.deps.metadata.updateCursor(remote.cursor);
      this.deps.events.emit("sync:success", { mode: "full" });
    });
  }

  async runIncrementalSync(localChanges: DriveEntry[]): Promise<void> {
    await this.syncWithRetry(async () => {
      this.deps.events.emit("sync:start", { mode: "incremental" });
      for (const change of localChanges) {
        if (change.deleted) {
          this.deps.metadata.deleteLocalEntry(change.path);
          await this.deps.api.deleteEntry(change.path);
          continue;
        }
        this.deps.metadata.upsertLocalEntry(change);
        await this.deps.api.upsertEntry(change);
      }

      const remote = await this.deps.api.listEntries(this.deps.metadata.getCursor());
      for (const remoteEntry of remote.entries) {
        if (remoteEntry.deleted) {
          this.deps.metadata.deleteLocalEntry(remoteEntry.path);
        } else {
          this.deps.metadata.upsertLocalEntry(remoteEntry);
        }
      }
      this.deps.metadata.updateCursor(remote.cursor);
      this.deps.metadata.setLastSyncedEntries(this.deps.metadata.getLocalSnapshot().entries.values());
      this.deps.events.emit("sync:success", { mode: "incremental" });
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
      await this.deps.api.upsertEntry(local);
      return;
    }
    if (decision === "useRemote") {
      localMap.set(remote.path, clone(remote));
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
      throw error;
    }
  }
}
