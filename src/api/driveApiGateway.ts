import { TokenVault } from "../security/tokenVault";
import { DriveApiError, DriveEntry, RemoteChanges } from "../types";

export interface DriveApiGateway {
  listEntries(cursor: number): Promise<RemoteChanges>;
  upsertEntry(entry: DriveEntry): Promise<void>;
  deleteEntry(path: string): Promise<void>;
  uploadEntryChunk?(entry: DriveEntry, offset: number, chunkSize: number): Promise<number>;
  uploadEntryInChunks?(entry: DriveEntry, chunkSize: number): Promise<void>;
  downloadEntryInChunks?(path: string, chunkSize: number): Promise<DriveEntry | undefined>;
}

const cloneEntry = (entry: DriveEntry): DriveEntry => ({ ...entry });

export class InMemoryDriveApiGateway implements DriveApiGateway {
  private entries = new Map<string, DriveEntry>();
  private changeLog: Array<{ cursor: number; entry: DriveEntry }> = [];
  private nextCursor = 1;
  private chunkUploadCounts = new Map<string, number>();
  private chunkUploadedBytes = new Map<string, number>();

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

  async uploadEntryInChunks(entry: DriveEntry, chunkSize: number): Promise<void> {
    const size = Math.max(0, entry.size ?? 0);
    const chunks = Math.max(1, Math.ceil(size / Math.max(1, chunkSize)));
    this.chunkUploadCounts.set(entry.path, chunks);
    await this.upsertEntry(entry);
  }

  async uploadEntryChunk(entry: DriveEntry, offset: number, chunkSize: number): Promise<number> {
    const size = Math.max(0, entry.size ?? 0);
    const safeOffset = Math.max(0, offset);
    const uploaded = Math.max(0, Math.min(Math.max(1, chunkSize), size - safeOffset));
    const mergedUploaded = Math.max(safeOffset + uploaded, this.chunkUploadedBytes.get(entry.path) ?? 0);
    this.chunkUploadedBytes.set(entry.path, mergedUploaded);
    const chunks = Math.max(1, Math.ceil(size / Math.max(1, chunkSize)));
    this.chunkUploadCounts.set(entry.path, chunks);
    if (mergedUploaded >= size) {
      await this.upsertEntry(entry);
      this.chunkUploadedBytes.delete(entry.path);
    }
    return uploaded;
  }

  async downloadEntryInChunks(path: string, _chunkSize: number): Promise<DriveEntry | undefined> {
    const entry = this.entries.get(path);
    return entry ? cloneEntry(entry) : undefined;
  }

  getChunkUploadCount(path: string): number {
    return this.chunkUploadCounts.get(path) ?? 0;
  }

  private appendChange(entry: DriveEntry): void {
    const cursor = this.nextCursor++;
    this.changeLog.push({ cursor, entry: cloneEntry(entry) });
  }

  private currentCursor(): number {
    return this.nextCursor - 1;
  }
}

export interface SynologyGatewayOptions {
  tokenVault: TokenVault;
  backend?: DriveApiGateway;
  requestLimit?: number;
  requestWindowMs?: number;
  readOnlyPathPrefixes?: string[];
}

export class SynologyDriveRestLikeGateway implements DriveApiGateway {
  private readonly backend: DriveApiGateway;
  private readonly requestLimit: number;
  private readonly requestWindowMs: number;
  private readonly readOnlyPathPrefixes: string[];
  private windowStartedAt = 0;
  private windowRequests = 0;

  constructor(private readonly options: SynologyGatewayOptions) {
    this.backend = options.backend ?? new InMemoryDriveApiGateway();
    this.requestLimit = Math.max(1, options.requestLimit ?? 10);
    this.requestWindowMs = Math.max(1, options.requestWindowMs ?? 1000);
    this.readOnlyPathPrefixes = options.readOnlyPathPrefixes ?? [];
  }

  async listEntries(cursor: number): Promise<RemoteChanges> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    return this.backend.listEntries(cursor);
  }

  async upsertEntry(entry: DriveEntry): Promise<void> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    this.assertWritable(entry.path);
    await this.backend.upsertEntry(entry);
  }

  async deleteEntry(path: string): Promise<void> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    this.assertWritable(path);
    await this.backend.deleteEntry(path);
  }

  async uploadEntryChunk(entry: DriveEntry, offset: number, chunkSize: number): Promise<number> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    this.assertWritable(entry.path);
    if (!this.backend.uploadEntryChunk) {
      throw new DriveApiError("NOT_FOUND", "chunk upload endpoint unavailable");
    }
    return this.backend.uploadEntryChunk(entry, offset, chunkSize);
  }

  async uploadEntryInChunks(entry: DriveEntry, chunkSize: number): Promise<void> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    this.assertWritable(entry.path);
    if (!this.backend.uploadEntryInChunks) {
      throw new DriveApiError("NOT_FOUND", "chunk upload endpoint unavailable");
    }
    await this.backend.uploadEntryInChunks(entry, chunkSize);
  }

  async downloadEntryInChunks(path: string, chunkSize: number): Promise<DriveEntry | undefined> {
    this.assertAuthorized();
    this.assertWithinRateLimit();
    if (!this.backend.downloadEntryInChunks) {
      throw new DriveApiError("NOT_FOUND", "chunk download endpoint unavailable");
    }
    return this.backend.downloadEntryInChunks(path, chunkSize);
  }

  private assertAuthorized(): void {
    if (!this.options.tokenVault.getToken()) {
      throw new DriveApiError("UNAUTHORIZED", "missing auth token");
    }
  }

  private assertWritable(path: string): void {
    if (this.readOnlyPathPrefixes.some((prefix) => path.startsWith(prefix))) {
      throw new DriveApiError("FORBIDDEN", `path is read-only: ${path}`);
    }
  }

  private assertWithinRateLimit(): void {
    const now = Date.now();
    if (now - this.windowStartedAt >= this.requestWindowMs) {
      this.windowStartedAt = now;
      this.windowRequests = 0;
    }
    this.windowRequests += 1;
    if (this.windowRequests > this.requestLimit) {
      throw new DriveApiError("RATE_LIMITED", "too many requests");
    }
  }
}
