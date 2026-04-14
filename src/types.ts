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

export interface SchedulerCheckpoint {
  paused: boolean;
  queuedTaskIds: string[];
}

export type DriveApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "RATE_LIMITED" | "NOT_FOUND";

export class DriveApiError extends Error {
  constructor(
    public readonly code: DriveApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DriveApiError";
  }
}

export interface TransferCheckpoint {
  path: string;
  chunkSize: number;
  totalSize: number;
  uploadedBytes: number;
  updatedAt: number;
}
