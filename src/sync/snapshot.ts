import { DriveEntry, Snapshot } from "../types";

const clone = (entry: DriveEntry): DriveEntry => ({ ...entry });

export function buildSnapshot(entries: Iterable<DriveEntry>): Snapshot {
  const map = new Map<string, DriveEntry>();
  for (const entry of entries) {
    map.set(entry.path, clone(entry));
  }
  return { entries: map };
}
