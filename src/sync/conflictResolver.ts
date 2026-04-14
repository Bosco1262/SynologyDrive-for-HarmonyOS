import { ConflictDecision, DriveEntry } from "../types";

export interface ConflictResolver {
  decide(local: DriveEntry, remote: DriveEntry): ConflictDecision;
}

export class TimestampConflictResolver implements ConflictResolver {
  decide(local: DriveEntry, remote: DriveEntry): ConflictDecision {
    if (local.contentHash === remote.contentHash && local.deleted === remote.deleted) {
      return "useLocal";
    }
    if (local.modifiedAt === remote.modifiedAt) {
      return "keepBoth";
    }
    return local.modifiedAt > remote.modifiedAt ? "useLocal" : "useRemote";
  }
}
