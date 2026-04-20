import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  InMemoryDriveApiGateway,
  SynologyDriveRestLikeGateway,
} from "../api/driveApiGateway";
import { TokenVault } from "../security/tokenVault";
import { MetadataStore } from "../storage/metadataStore";
import { PersistentMetadataStore } from "../storage/persistentMetadataStore";
import { ChunkTransferManager } from "../sync/chunkTransfer";
import { DriveApiError, DriveEntry } from "../types";

const file = (path: string, size: number): DriveEntry => ({
  path,
  type: "file",
  modifiedAt: Date.now(),
  version: 1,
  size,
  contentHash: `${path}-${size}`,
});

describe("Phase 4 features", () => {
  it("enforces auth, permission and rate-limit in synology-like gateway", async () => {
    const backend = new InMemoryDriveApiGateway([]);
    const tokenVault = new TokenVault();
    const api = new SynologyDriveRestLikeGateway({
      tokenVault,
      backend,
      readOnlyPathPrefixes: ["/readonly"],
      requestLimit: 2,
      requestWindowMs: 60_000,
    });

    await expect(api.listEntries(0)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<DriveApiError>);

    tokenVault.setToken("12345678");
    await expect(api.upsertEntry(file("/readonly/a.txt", 4))).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<DriveApiError>);

    await api.listEntries(0);
    await expect(api.listEntries(0)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    } satisfies Partial<DriveApiError>);
  });

  it("persists cursor, scheduler checkpoint and transfer checkpoint to disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "phase4-metadata-"));
    const stateFile = join(dir, "metadata.json");

    const storeA = new PersistentMetadataStore(stateFile);
    storeA.updateCursor(42);
    storeA.setSchedulerCheckpoint({ paused: true, queuedTaskIds: ["sync-task"] });
    storeA.setTransferCheckpoint({
      path: "/big.bin",
      chunkSize: 4,
      totalSize: 20,
      uploadedBytes: 8,
      updatedAt: Date.now(),
    });

    const storeB = new PersistentMetadataStore(stateFile);
    expect(storeB.getCursor()).toBe(42);
    expect(storeB.getSchedulerCheckpoint()).toEqual({
      paused: true,
      queuedTaskIds: ["sync-task"],
    });
    expect(storeB.getTransferCheckpoint("/big.bin")?.uploadedBytes).toBe(8);

    rmSync(dir, { recursive: true, force: true });
  });

  it("resumes chunk upload from checkpoint and clears checkpoint on completion", async () => {
    const api = new InMemoryDriveApiGateway([]);
    const metadata = new MetadataStore();
    metadata.setTransferCheckpoint({
      path: "/resume.bin",
      chunkSize: 4,
      totalSize: 12,
      uploadedBytes: 4,
      updatedAt: Date.now(),
    });
    const transfer = new ChunkTransferManager({ thresholdSize: 8, chunkSize: 4 });
    await transfer.upload(api, file("/resume.bin", 12), metadata);

    expect(metadata.getTransferCheckpoint("/resume.bin")).toBeUndefined();
    expect(api.getChunkUploadCount("/resume.bin")).toBe(3);
  });
});
