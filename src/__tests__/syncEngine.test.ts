import { describe, expect, it } from "vitest";
import { InMemoryDriveApiGateway } from "../api/driveApiGateway";
import { EventBus } from "../core/eventBus";
import { InMemoryNotificationCenter } from "../notification/notificationCenter";
import { InMemoryTaskLogger } from "../observability/taskLogger";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { MetadataStore } from "../storage/metadataStore";
import { TimestampConflictResolver } from "../sync/conflictResolver";
import { SelectiveSyncPolicy } from "../sync/selectiveSyncPolicy";
import { SpeedLimiter } from "../sync/speedLimiter";
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

  it("applies selective sync policy when pushing local changes", async () => {
    const api = new InMemoryDriveApiGateway([]);
    const metadata = new MetadataStore();
    const engine = new SyncEngine({
      api,
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events: new EventBus(),
      deadLetters: new DeadLetterQueue(),
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
      selectiveSync: new SelectiveSyncPolicy({
        includePaths: ["/work"],
        excludePaths: ["/work/private"],
      }),
    });

    await engine.initializeLocal([]);
    await engine.runIncrementalSync([
      file("/work/ok.txt", 100, "a"),
      file("/work/private/no.txt", 101, "b"),
      file("/other/skip.txt", 102, "c"),
    ]);

    const remote = await api.listEntries(0);
    expect(remote.entries.some((entry) => entry.path === "/work/ok.txt")).toBe(true);
    expect(remote.entries.some((entry) => entry.path === "/work/private/no.txt")).toBe(false);
    expect(remote.entries.some((entry) => entry.path === "/other/skip.txt")).toBe(false);
  });

  it("records logs, emits notifications and invokes speed limiter", async () => {
    class SpySpeedLimiter implements SpeedLimiter {
      calls: number[] = [];
      async throttle(bytes: number): Promise<void> {
        this.calls.push(bytes);
      }
    }

    const api = new InMemoryDriveApiGateway([]);
    const metadata = new MetadataStore();
    const logger = new InMemoryTaskLogger();
    const notifications = new InMemoryNotificationCenter();
    const limiter = new SpySpeedLimiter();

    const engine = new SyncEngine({
      api,
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events: new EventBus(),
      deadLetters: new DeadLetterQueue(),
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
      logger,
      notifications,
      speedLimiter: limiter,
    });

    await engine.initializeLocal([]);
    await engine.runIncrementalSync([file("/speed/a.txt", 200, "abcd")]);

    expect(limiter.calls.length).toBeGreaterThan(0);
    expect(logger.list().some((record) => record.message === "sync started")).toBe(true);
    expect(logger.list().some((record) => record.message === "sync finished")).toBe(true);
    expect(notifications.list().some((item) => item.title === "同步开始")).toBe(true);
    expect(notifications.list().some((item) => item.title === "同步完成")).toBe(true);
  });
});
