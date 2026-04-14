import { DriveApiGateway } from "../api/driveApiGateway";
import { MetadataStore } from "../storage/metadataStore";
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

  async upload(api: DriveApiGateway, entry: DriveEntry, metadata?: MetadataStore): Promise<void> {
    if (this.shouldUseChunking(entry) && api.uploadEntryChunk) {
      const size = Math.max(0, entry.size ?? 0);
      const checkpoint = metadata?.getTransferCheckpoint(entry.path);
      let uploadedBytes = checkpoint?.uploadedBytes ?? 0;
      while (uploadedBytes < size) {
        const uploaded = await api.uploadEntryChunk(entry, uploadedBytes, this.options.chunkSize);
        if (uploaded <= 0) {
          break;
        }
        uploadedBytes += uploaded;
        metadata?.setTransferCheckpoint({
          path: entry.path,
          chunkSize: this.options.chunkSize,
          totalSize: size,
          uploadedBytes,
          updatedAt: Date.now(),
        });
      }
      if (uploadedBytes >= size) {
        metadata?.clearTransferCheckpoint(entry.path);
      }
      return;
    }
    if (this.shouldUseChunking(entry) && api.uploadEntryInChunks) {
      await api.uploadEntryInChunks(entry, this.options.chunkSize);
      return;
    }
    await api.upsertEntry(entry);
  }

  async download(api: DriveApiGateway, entry: DriveEntry): Promise<DriveEntry | undefined> {
    if (this.shouldUseChunking(entry) && api.downloadEntryInChunks) {
      return api.downloadEntryInChunks(entry.path, this.options.chunkSize);
    }
    return undefined;
  }
}
