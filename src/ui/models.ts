export interface LoginViewState {
  loggedIn: boolean;
  username?: string;
  message?: string;
}

export interface SyncTaskViewState {
  running: boolean;
  progress: number;
  latestMessage?: string;
}
