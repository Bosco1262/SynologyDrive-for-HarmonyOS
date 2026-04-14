import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DriveEntry } from "../types";

export interface LocalFileStore {
  read(path: string): Uint8Array;
  write(path: string, data: Uint8Array): void;
  stat(path: string): { size: number; modifiedAt: number };
  toEntry(path: string, version?: number): DriveEntry;
}

export class FsLocalFileStore implements LocalFileStore {
  read(path: string): Uint8Array {
    return readFileSync(path);
  }

  write(path: string, data: Uint8Array): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }

  stat(path: string): { size: number; modifiedAt: number } {
    const stats = statSync(path);
    return {
      size: stats.size,
      modifiedAt: stats.mtimeMs,
    };
  }

  toEntry(path: string, version = 1): DriveEntry {
    if (!existsSync(path)) {
      throw new Error(`file not found: ${path}`);
    }
    const content = this.read(path);
    const meta = this.stat(path);
    const contentHash = createHash("sha256").update(content).digest("hex");
    return {
      path,
      type: "file",
      modifiedAt: Math.trunc(meta.modifiedAt),
      version,
      size: meta.size,
      contentHash,
    };
  }
}
