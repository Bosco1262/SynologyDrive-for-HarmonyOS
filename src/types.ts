export type EntryType = "file" | "folder";

export interface DriveEntry {
  path: string;
  type: EntryType;
  modifiedAt: number;
  version: number;
  contentHash?: string;
  size?: number;
  deleted?: boolean;
  lockToken?: string;
}

export interface Snapshot {
  entries: Map<string, DriveEntry>;
}

export interface RemoteChanges {
  entries: DriveEntry[];
  cursor: number;
}

export type ConflictDecision = "useLocal" | "useRemote" | "keepBoth";

export interface SyncTaskState {
  id: string;
  paused: boolean;
  status: "idle" | "running" | "error";
  lastError?: string;
}
