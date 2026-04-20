import {
  DriveEntry,
  SchedulerCheckpoint,
  Snapshot,
  SyncTaskState,
  TransferCheckpoint,
} from "../types";

const cloneEntry = (entry: DriveEntry): DriveEntry => ({ ...entry });

export class MetadataStore {
  private localEntries = new Map<string, DriveEntry>();
  private lastSyncedEntries = new Map<string, DriveEntry>();
  private cursor = 0;
  private taskState = new Map<string, SyncTaskState>();
  private schedulerCheckpoint?: SchedulerCheckpoint;
  private transferCheckpoint = new Map<string, TransferCheckpoint>();

  getLocalSnapshot(): Snapshot {
    return { entries: new Map([...this.localEntries].map(([k, v]) => [k, cloneEntry(v)])) };
  }

  getLastSyncedSnapshot(): Snapshot {
    return {
      entries: new Map([...this.lastSyncedEntries].map(([k, v]) => [k, cloneEntry(v)])),
    };
  }

  setLocalEntries(entries: Iterable<DriveEntry>): void {
    this.localEntries.clear();
    for (const entry of entries) {
      this.localEntries.set(entry.path, cloneEntry(entry));
    }
  }

  upsertLocalEntry(entry: DriveEntry): void {
    this.localEntries.set(entry.path, cloneEntry(entry));
  }

  deleteLocalEntry(path: string): void {
    this.localEntries.delete(path);
  }

  setLastSyncedEntries(entries: Iterable<DriveEntry>): void {
    this.lastSyncedEntries.clear();
    for (const entry of entries) {
      this.lastSyncedEntries.set(entry.path, cloneEntry(entry));
    }
  }

  updateCursor(cursor: number): void {
    this.cursor = cursor;
  }

  getCursor(): number {
    return this.cursor;
  }

  setTaskState(state: SyncTaskState): void {
    this.taskState.set(state.id, { ...state });
  }

  getTaskState(taskId: string): SyncTaskState | undefined {
    const state = this.taskState.get(taskId);
    return state ? { ...state } : undefined;
  }

  getAllTaskStates(): SyncTaskState[] {
    return [...this.taskState.values()].map((state) => ({ ...state }));
  }

  setAllTaskStates(states: Iterable<SyncTaskState>): void {
    this.taskState.clear();
    for (const state of states) {
      this.taskState.set(state.id, { ...state });
    }
  }

  setSchedulerCheckpoint(checkpoint: SchedulerCheckpoint): void {
    this.schedulerCheckpoint = {
      paused: checkpoint.paused,
      queuedTaskIds: [...checkpoint.queuedTaskIds],
    };
  }

  getSchedulerCheckpoint(): SchedulerCheckpoint | undefined {
    if (!this.schedulerCheckpoint) {
      return undefined;
    }
    return {
      paused: this.schedulerCheckpoint.paused,
      queuedTaskIds: [...this.schedulerCheckpoint.queuedTaskIds],
    };
  }

  setTransferCheckpoint(checkpoint: TransferCheckpoint): void {
    this.transferCheckpoint.set(checkpoint.path, { ...checkpoint });
  }

  getTransferCheckpoint(path: string): TransferCheckpoint | undefined {
    const checkpoint = this.transferCheckpoint.get(path);
    return checkpoint ? { ...checkpoint } : undefined;
  }

  clearTransferCheckpoint(path: string): void {
    this.transferCheckpoint.delete(path);
  }

  listTransferCheckpoints(): TransferCheckpoint[] {
    return [...this.transferCheckpoint.values()].map((checkpoint) => ({ ...checkpoint }));
  }
}
