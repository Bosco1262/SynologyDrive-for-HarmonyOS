import { DriveEntry, Snapshot } from "../types";

export interface DiffResult {
  upserts: DriveEntry[];
  deletes: string[];
}

const changed = (a: DriveEntry | undefined, b: DriveEntry | undefined): boolean => {
  if (!a || !b) {
    return a !== b;
  }
  return (
    a.version !== b.version ||
    a.modifiedAt !== b.modifiedAt ||
    a.contentHash !== b.contentHash ||
    a.deleted !== b.deleted
  );
};

export function diffSnapshots(from: Snapshot, to: Snapshot): DiffResult {
  const upserts: DriveEntry[] = [];
  const deletes: string[] = [];
  const allPaths = new Set([...from.entries.keys(), ...to.entries.keys()]);

  for (const path of allPaths) {
    const before = from.entries.get(path);
    const after = to.entries.get(path);
    if (!after && before) {
      deletes.push(path);
      continue;
    }
    if (after && changed(before, after)) {
      upserts.push({ ...after });
    }
  }

  return { upserts, deletes };
}
