import { DriveEntry, RemoteChanges } from "../types";

export interface DriveApiGateway {
  listEntries(cursor: number): Promise<RemoteChanges>;
  upsertEntry(entry: DriveEntry): Promise<void>;
  deleteEntry(path: string): Promise<void>;
}

const cloneEntry = (entry: DriveEntry): DriveEntry => ({ ...entry });

export class InMemoryDriveApiGateway implements DriveApiGateway {
  private entries = new Map<string, DriveEntry>();
  private changeLog: Array<{ cursor: number; entry: DriveEntry }> = [];
  private nextCursor = 1;

  constructor(seed: DriveEntry[] = []) {
    for (const entry of seed) {
      this.entries.set(entry.path, cloneEntry(entry));
      this.appendChange(entry);
    }
  }

  async listEntries(cursor: number): Promise<RemoteChanges> {
    const deltas = this.changeLog
      .filter((change) => change.cursor > cursor)
      .map((change) => cloneEntry(change.entry));
    return { entries: deltas, cursor: this.currentCursor() };
  }

  async upsertEntry(entry: DriveEntry): Promise<void> {
    this.entries.set(entry.path, cloneEntry(entry));
    this.appendChange(entry);
  }

  async deleteEntry(path: string): Promise<void> {
    this.entries.delete(path);
    this.appendChange({
      path,
      type: "file",
      modifiedAt: Date.now(),
      version: 0,
      deleted: true,
    });
  }

  private appendChange(entry: DriveEntry): void {
    const cursor = this.nextCursor++;
    this.changeLog.push({ cursor, entry: cloneEntry(entry) });
  }

  private currentCursor(): number {
    return this.nextCursor - 1;
  }
}
