import { DriveApiGateway } from "../api/driveApiGateway";
import { DriveEntry } from "../types";

export interface ChunkTransferOptions {
  chunkSize: number;
  thresholdSize: number;
}

const defaultOptions: ChunkTransferOptions = {
  chunkSize: 512 * 1024,
  thresholdSize: 5 * 1024 * 1024,
};

export class ChunkTransferManager {
  private readonly options: ChunkTransferOptions;

  constructor(options: Partial<ChunkTransferOptions> = {}) {
    this.options = {
      chunkSize: Math.max(1, options.chunkSize ?? defaultOptions.chunkSize),
      thresholdSize: Math.max(1, options.thresholdSize ?? defaultOptions.thresholdSize),
    };
  }

  shouldUseChunking(entry: DriveEntry): boolean {
    return (entry.size ?? 0) >= this.options.thresholdSize;
  }

  async upload(api: DriveApiGateway, entry: DriveEntry): Promise<void> {
    if (this.shouldUseChunking(entry) && api.uploadEntryInChunks) {
      await api.uploadEntryInChunks(entry, this.options.chunkSize);
      return;
    }
    await api.upsertEntry(entry);
  }

  async download(api: DriveApiGateway, entry: DriveEntry): Promise<DriveEntry> {
    if (this.shouldUseChunking(entry) && api.downloadEntryInChunks) {
      const downloaded = await api.downloadEntryInChunks(entry.path, this.options.chunkSize);
      if (downloaded) {
        return downloaded;
      }
    }
    return { ...entry };
  }
}
