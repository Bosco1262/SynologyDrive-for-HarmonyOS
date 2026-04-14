export type NotificationLevel = "info" | "warning" | "error";

export interface Notification {
  timestamp: number;
  title: string;
  message: string;
  level: NotificationLevel;
}

export interface NotificationCenter {
  notify(title: string, message: string, level?: NotificationLevel): void;
  list(): Notification[];
}

export class InMemoryNotificationCenter implements NotificationCenter {
  private readonly notifications: Notification[] = [];

  notify(title: string, message: string, level: NotificationLevel = "info"): void {
    this.notifications.push({
      timestamp: Date.now(),
      title,
      message,
      level,
    });
  }

  list(): Notification[] {
    return [...this.notifications];
  }
}

