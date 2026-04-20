import { describe, expect, it } from "vitest";
import { InMemoryDriveApiGateway } from "../api/driveApiGateway";
import { ReconnectableQuickConnectClient } from "../api/quickConnect";
import { EventBus } from "../core/eventBus";
import { DeadLetterQueue } from "../reliability/deadLetterQueue";
import { TokenVault } from "../security/tokenVault";
import { MetadataStore } from "../storage/metadataStore";
import { TimestampConflictResolver } from "../sync/conflictResolver";
import { SyncEngine } from "../sync/syncEngine";
import { DriveEntry } from "../types";
import { DesktopSyncViewModel } from "../ui/desktopSyncViewModel";

const file = (path: string): DriveEntry => ({
  path,
  type: "file",
  modifiedAt: Date.now(),
  version: 1,
  contentHash: path,
  size: 10,
});

describe("DesktopSyncViewModel", () => {
  it("builds file/task page state from sync metadata", async () => {
    const metadata = new MetadataStore();
    const engine = new SyncEngine({
      api: new InMemoryDriveApiGateway([]),
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events: new EventBus(),
      deadLetters: new DeadLetterQueue(),
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
    });
    const viewModel = new DesktopSyncViewModel({
      engine,
      metadata,
      tokenVault: new TokenVault(),
      quickConnect: new ReconnectableQuickConnectClient({
        async resolveServerAddress(): Promise<string> {
          return "https://nas.example.com";
        },
      }),
    });

    await viewModel.loginAndConnect("bosco", "12345678", "my-nas");
    await engine.initializeLocal([]);
    await viewModel.runIncrementalSync([file("/work/a.txt"), file("/work/b.txt")]);
    metadata.setTaskState({ id: "full-sync", paused: false, status: "idle" });

    const state = viewModel.getState("/work");
    expect(state.login.loggedIn).toBe(true);
    expect(state.connection.connected).toBe(true);
    expect(state.files.length).toBe(2);
    expect(state.files.every((item) => item.status === "已同步")).toBe(true);
    expect(state.tasks.some((task) => task.id === "incremental-sync")).toBe(true);
  });

  it("marks disconnected state and retries reconnection", async () => {
    let resolved = 0;
    const metadata = new MetadataStore();
    const engine = new SyncEngine({
      api: new InMemoryDriveApiGateway([]),
      metadata,
      conflictResolver: new TimestampConflictResolver(),
      events: new EventBus(),
      deadLetters: new DeadLetterQueue(),
      retryPolicy: { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
    });
    const viewModel = new DesktopSyncViewModel({
      engine,
      metadata,
      tokenVault: new TokenVault(),
      quickConnect: new ReconnectableQuickConnectClient({
        async resolveServerAddress(): Promise<string> {
          resolved += 1;
          return resolved === 1 ? "https://nas-a.example.com" : "https://nas-b.example.com";
        },
      }),
    });

    await viewModel.loginAndConnect("bosco", "12345678", "my-nas");
    viewModel.markDisconnected();
    await viewModel.reconnectQuickConnect();

    const state = viewModel.getState();
    expect(state.connection.connected).toBe(true);
    expect(state.connection.serverAddress).toBe("https://nas-b.example.com");
  });
});
