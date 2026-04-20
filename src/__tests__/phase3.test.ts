import { describe, expect, it } from "vitest";
import { InMemoryDriveApiGateway } from "../api/driveApiGateway";
import { EventBus } from "../core/eventBus";
import { InMemoryNotificationCenter } from "../notification/notificationCenter";
import { InMemoryTaskLogger } from "../observability/taskLogger";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { SyncLifecycleCoordinator } from "../scheduler/syncLifecycleCoordinator";
import { SyncTaskScheduler } from "../scheduler/syncTaskScheduler";
import { MetadataStore } from "../storage/metadataStore";
import { AdvancedConflictResolver } from "../sync/advancedConflictResolver";
import { ChunkTransferManager } from "../sync/chunkTransfer";
import { SyncEngine } from "../sync/syncEngine";
import { DriveEntry } from "../types";

const file = (
  path: string,
  modifiedAt: number,
  hash: string,
  version = 1,
  size = hash.length,
): DriveEntry => ({
  path,
  type: "file",
  modifiedAt,
  version,
  contentHash: hash,
  size,
});

const waitTick = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("Phase 3 features", () => {
  it("supports version-first and manual conflict strategies", () => {
    const local = file("/a.txt", 100, "l", 3);
    const remote = file("/a.txt", 200, "r", 2);
    const versionResolver = new AdvancedConflictResolver({ strategy: "version" });
    expect(versionResolver.decide(local, remote)).toBe("useLocal");

    const manualResolver = new AdvancedConflictResolver({
      strategy: "manual",
      manualHandler: () => "keepBoth",
    });
    expect(manualResolver.decide(local, remote)).toBe("keepBoth");
  });

  it("uses chunked transfer for large file upload", async () => {
    const api = new InMemoryDriveApiGateway([]);
    const metadata = new MetadataStore();
    const engine = new SyncEngine({
      api,
      metadata,
      conflictResolver: new AdvancedConflictResolver({ strategy: "timestamp" }),
      events: new EventBus(),
      deadLetters: new DeadLetterQueue(),
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
      chunkTransfer: new ChunkTransferManager({ thresholdSize: 10, chunkSize: 4 }),
      logger: new InMemoryTaskLogger(),
      notifications: new InMemoryNotificationCenter(),
    });

    const largeFile = file("/large.bin", 100, "hash", 1, 32);
    await engine.initializeLocal([]);
    await engine.runIncrementalSync([largeFile]);

    expect(api.getChunkUploadCount("/large.bin")).toBe(8);
  });

  it("can checkpoint and restore queued tasks across lifecycle", async () => {
    const metadata = new MetadataStore();
    const schedulerA = new SyncTaskScheduler();
    schedulerA.registerTask("sync-task", async () => {});
    schedulerA.pause();
    schedulerA.enqueueById("sync-task");
    const coordinatorA = new SyncLifecycleCoordinator(schedulerA, metadata);
    coordinatorA.saveCheckpoint();

    const executed: string[] = [];
    const schedulerB = new SyncTaskScheduler();
    schedulerB.registerTask("sync-task", async () => {
      executed.push("done");
    });
    const coordinatorB = new SyncLifecycleCoordinator(schedulerB, metadata);
    coordinatorB.restoreCheckpoint();
    schedulerB.resume();
    await waitTick();

    expect(executed).toEqual(["done"]);
  });
});
