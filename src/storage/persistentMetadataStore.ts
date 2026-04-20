import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DriveEntry, SchedulerCheckpoint, SyncTaskState, TransferCheckpoint } from "../types";
import { MetadataStore } from "./metadataStore";

interface MetadataStateFile {
  localEntries: DriveEntry[];
  lastSyncedEntries: DriveEntry[];
  cursor: number;
  taskStates: SyncTaskState[];
  schedulerCheckpoint?: SchedulerCheckpoint;
  transferCheckpoints: TransferCheckpoint[];
}

export class PersistentMetadataStore extends MetadataStore {
  constructor(private readonly filePath: string) {
    super();
    this.restore();
  }

  override setLocalEntries(entries: Iterable<DriveEntry>): void {
    super.setLocalEntries(entries);
    this.flush();
  }

  override upsertLocalEntry(entry: DriveEntry): void {
    super.upsertLocalEntry(entry);
    this.flush();
  }

  override deleteLocalEntry(path: string): void {
    super.deleteLocalEntry(path);
    this.flush();
  }

  override setLastSyncedEntries(entries: Iterable<DriveEntry>): void {
    super.setLastSyncedEntries(entries);
    this.flush();
  }

  override updateCursor(cursor: number): void {
    super.updateCursor(cursor);
    this.flush();
  }

  override setTaskState(state: SyncTaskState): void {
    super.setTaskState(state);
    this.flush();
  }

  override setAllTaskStates(states: Iterable<SyncTaskState>): void {
    super.setAllTaskStates(states);
    this.flush();
  }

  override setSchedulerCheckpoint(checkpoint: SchedulerCheckpoint): void {
    super.setSchedulerCheckpoint(checkpoint);
    this.flush();
  }

  override setTransferCheckpoint(checkpoint: TransferCheckpoint): void {
    super.setTransferCheckpoint(checkpoint);
    this.flush();
  }

  override clearTransferCheckpoint(path: string): void {
    super.clearTransferCheckpoint(path);
    this.flush();
  }

  private restore(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<MetadataStateFile>;
    super.setLocalEntries(parsed.localEntries ?? []);
    super.setLastSyncedEntries(parsed.lastSyncedEntries ?? []);
    super.updateCursor(parsed.cursor ?? 0);
    super.setAllTaskStates(parsed.taskStates ?? []);
    if (parsed.schedulerCheckpoint) {
      super.setSchedulerCheckpoint(parsed.schedulerCheckpoint);
    }
    for (const checkpoint of parsed.transferCheckpoints ?? []) {
      super.setTransferCheckpoint(checkpoint);
    }
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const schedulerCheckpoint = this.getSchedulerCheckpoint();
    const state: MetadataStateFile = {
      localEntries: [...this.getLocalSnapshot().entries.values()],
      lastSyncedEntries: [...this.getLastSyncedSnapshot().entries.values()],
      cursor: this.getCursor(),
      taskStates: this.getAllTaskStates(),
      transferCheckpoints: this.listTransferCheckpoints(),
      ...(schedulerCheckpoint ? { schedulerCheckpoint } : {}),
    };
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }
}
