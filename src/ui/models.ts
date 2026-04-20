export interface LoginViewState {
  loggedIn: boolean;
  username?: string;
  message?: string;
}

export interface SyncTaskViewState {
  id: string;
  running: boolean;
  progress: number;
  status: "idle" | "running" | "error";
  latestMessage?: string;
}

export type DesktopPage = "login" | "files" | "tasks" | "settings";

export interface ConnectionViewState {
  quickConnectId?: string;
  serverAddress?: string;
  connected: boolean;
  reconnecting: boolean;
  retryCount: number;
  lastError?: string;
}

export interface FileViewState {
  path: string;
  type: "file" | "folder";
  size: number;
  modifiedAt: number;
  status: string;
}

export interface SettingsViewState {
  autoSync: boolean;
  bandwidthLimitKb: number;
}

export interface DesktopViewState {
  activePage: DesktopPage;
  login: LoginViewState;
  connection: ConnectionViewState;
  files: FileViewState[];
  tasks: SyncTaskViewState[];
  settings: SettingsViewState;
}
