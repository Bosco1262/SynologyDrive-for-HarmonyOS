export interface SelectiveSyncConfig {
  includePaths?: string[];
  excludePaths?: string[];
}

const normalize = (path: string): string => {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
};

const matchesPrefix = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

export class SelectiveSyncPolicy {
  private readonly includes: string[];
  private readonly excludes: string[];

  constructor(config: SelectiveSyncConfig = {}) {
    this.includes = (config.includePaths ?? []).map(normalize);
    this.excludes = (config.excludePaths ?? []).map(normalize);
  }

  allows(path: string): boolean {
    const normalized = normalize(path);
    if (this.excludes.some((prefix) => matchesPrefix(normalized, prefix))) {
      return false;
    }
    if (this.includes.length === 0) {
      return true;
    }
    return this.includes.some((prefix) => matchesPrefix(normalized, prefix));
  }
}

