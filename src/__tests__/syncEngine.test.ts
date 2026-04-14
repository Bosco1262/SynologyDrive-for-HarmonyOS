import { describe, expect, it } from "vitest";
import { InMemoryDriveApiGateway } from "../api/driveApiGateway";
import { EventBus } from "../core/eventBus";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { MetadataStore } from "../storage/metadataStore";
import { TimestampConflictResolver } from "../sync/conflictResolver";
import { SyncEngine } from "../sync/syncEngine";
import { DriveEntry } from "../types";

const file = (
  path: string,
  modifiedAt: number,
  hash: string,
  version = 1,
): DriveEntry => ({
  path,
  type: "file",
  modifiedAt,
  version,
  contentHash: hash,
  size: hash.length,
});

describe("SyncEngine", () => {
  it("pulls remote entries into local on first sync", async () => {
    const remoteFile = file("/remote/a.txt", 100, "r1");
    const api = new InMemoryDriveApiGateway([remoteFile]);
    const metadata = new MetadataStore();
    const events = new EventBus();
    const dlq = new DeadLetterQueue();
    const engine = new SyncEngine({
      api,
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events,
      deadLetters: dlq,
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
    });

    await engine.initializeLocal([]);
    await engine.runFullSync();

    const local = metadata.getLocalSnapshot().entries;
    expect(local.get("/remote/a.txt")?.contentHash).toBe("r1");
  });

  it("pushes local changes and then tracks remote delta", async () => {
    const api = new InMemoryDriveApiGateway([]);
    const metadata = new MetadataStore();
    const events = new EventBus();
    const dlq = new DeadLetterQueue();
    const engine = new SyncEngine({
      api,
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events,
      deadLetters: dlq,
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
    });

    await engine.initializeLocal([file("/local/a.txt", 100, "l1")]);
    await engine.runFullSync();
    await engine.runIncrementalSync([file("/local/b.txt", 200, "l2")]);

    const remoteAfterPush = await api.listEntries(0);
    expect(remoteAfterPush.entries.some((entry) => entry.path === "/local/b.txt")).toBe(true);
  });
});
