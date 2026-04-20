import { ReconnectableQuickConnectClient } from "../api/quickConnect";
import { TokenVault } from "../security/tokenVault";
import { MetadataStore } from "../storage/metadataStore";
import { SyncEngine } from "../sync/syncEngine";
import { DriveEntry } from "../types";
import {
  ConnectionViewState,
  DesktopPage,
  DesktopViewState,
  FileViewState,
  LoginViewState,
  SettingsViewState,
  SyncTaskViewState,
} from "./models";

interface DesktopSyncViewModelDeps {
  engine: SyncEngine;
  metadata: MetadataStore;
  tokenVault: TokenVault;
  quickConnect: ReconnectableQuickConnectClient;
}

export class DesktopSyncViewModel {
  private activePage: DesktopPage = "login";
  private readonly login: LoginViewState = { loggedIn: false, message: "请先登录并连接 QuickConnect" };
  private readonly connection: ConnectionViewState = {
    connected: false,
    reconnecting: false,
    retryCount: 0,
  };
  private readonly settings: SettingsViewState = { autoSync: true, bandwidthLimitKb: 1024 };

  constructor(private readonly deps: DesktopSyncViewModelDeps) {}

  setActivePage(page: DesktopPage): void {
    this.activePage = page;
  }

  async loginAndConnect(username: string, token: string, quickConnectId: string): Promise<void> {
    this.deps.tokenVault.setToken(token);
    this.login.loggedIn = true;
    this.login.username = username;
    this.connection.quickConnectId = quickConnectId;
    await this.reconnectQuickConnect();
  }

  async reconnectQuickConnect(): Promise<void> {
    if (!this.connection.quickConnectId) {
      throw new Error("quickconnect id is required");
    }
    this.connection.reconnecting = true;
    try {
      this.connection.serverAddress = await this.deps.quickConnect.connect(this.connection.quickConnectId);
      this.connection.connected = true;
      delete this.connection.lastError;
      this.login.message = "已连接到 Synology 服务器";
    } catch (error) {
      this.connection.connected = false;
      this.connection.retryCount += 1;
      this.connection.lastError = error instanceof Error ? error.message : String(error);
      this.login.message = "连接失败，请检查 QuickConnect 配置";
      throw error;
    } finally {
      this.connection.reconnecting = false;
    }
  }

  markDisconnected(): void {
    this.deps.quickConnect.markDisconnected();
    this.connection.connected = false;
    this.login.message = "连接已断开，正在等待重连";
  }

  async runIncrementalSync(changes: DriveEntry[]): Promise<void> {
    this.deps.metadata.setTaskState({
      id: "incremental-sync",
      paused: false,
      status: "running",
    });
    try {
      await this.deps.quickConnect.runWithReconnect(async () => {
        await this.deps.engine.runIncrementalSync(changes);
      });
      this.deps.metadata.setTaskState({
        id: "incremental-sync",
        paused: false,
        status: "idle",
      });
    } catch (error) {
      this.connection.connected = false;
      this.deps.metadata.setTaskState({
        id: "incremental-sync",
        paused: false,
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getState(searchText = ""): DesktopViewState {
    const files = this.buildFiles(searchText);
    const tasks = this.buildTasks();
    return {
      activePage: this.activePage,
      login: { ...this.login },
      connection: { ...this.connection },
      files,
      tasks,
      settings: { ...this.settings },
    };
  }

  private buildFiles(searchText: string): FileViewState[] {
    const keyword = searchText.trim().toLowerCase();
    const taskRunning = this.deps.metadata.getAllTaskStates().some((task) => task.status === "running");
    return [...this.deps.metadata.getLocalSnapshot().entries.values()]
      .filter((entry) => !keyword || entry.path.toLowerCase().includes(keyword))
      .map((entry) => ({
        path: entry.path,
        type: entry.type,
        size: entry.size ?? 0,
        modifiedAt: entry.modifiedAt,
        status: entry.deleted ? "已删除" : taskRunning ? "同步中" : "已同步",
      }));
  }

  private buildTasks(): SyncTaskViewState[] {
    return this.deps.metadata.getAllTaskStates().map((task) => ({
      id: task.id,
      running: task.status === "running",
      progress: task.status === "running" ? 50 : task.status === "idle" ? 100 : 0,
      status: task.status,
      ...(task.lastError ? { latestMessage: task.lastError } : {}),
    }));
  }
}
