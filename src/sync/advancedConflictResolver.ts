import { ConflictDecision, DriveEntry } from "../types";
import { ConflictResolver, TimestampConflictResolver } from "./conflictResolver";

export type ConflictStrategy = "timestamp" | "version" | "manual";

export type ManualConflictHandler = (
  local: DriveEntry,
  remote: DriveEntry,
) => ConflictDecision;

export interface AdvancedConflictResolverOptions {
  strategy: ConflictStrategy;
  manualHandler?: ManualConflictHandler;
}

export class AdvancedConflictResolver implements ConflictResolver {
  private readonly timestampResolver = new TimestampConflictResolver();

  constructor(private readonly options: AdvancedConflictResolverOptions) {}

  decide(local: DriveEntry, remote: DriveEntry): ConflictDecision {
    if (this.options.strategy === "manual") {
      return this.options.manualHandler ? this.options.manualHandler(local, remote) : "keepBoth";
    }
    if (this.options.strategy === "version") {
      if (local.version === remote.version) {
        if (local.modifiedAt === remote.modifiedAt) {
          return "keepBoth";
        }
        return local.modifiedAt > remote.modifiedAt ? "useLocal" : "useRemote";
      }
      return local.version > remote.version ? "useLocal" : "useRemote";
    }
    return this.timestampResolver.decide(local, remote);
  }
}
