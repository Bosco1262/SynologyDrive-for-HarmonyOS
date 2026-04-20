const SENSITIVE_PATTERNS = [
  /(token=)[^&\s]+/gi,
  /(password=)[^&\s]+/gi,
  /(authorization:\s*bearer\s+)[^\s]+/gi,
];

export class AuditLogger {
  private logs: string[] = [];

  record(message: string): void {
    let safe = message;
    for (const pattern of SENSITIVE_PATTERNS) {
      safe = safe.replace(pattern, "$1***");
    }
    this.logs.push(safe);
  }

  readAll(): string[] {
    return [...this.logs];
  }
}
