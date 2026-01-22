/**
 * CI/CD Status Types
 * Summary-level tracking of continuous integration status
 */

export type CIState = "pending" | "passing" | "failing" | "unknown";

export interface CIStatus {
  readonly state: CIState;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly pending: number;
}

export function createCIStatus(partial: Partial<CIStatus> = {}): CIStatus {
  return Object.freeze({
    state: partial.state ?? "unknown",
    total: partial.total ?? 0,
    passed: partial.passed ?? 0,
    failed: partial.failed ?? 0,
    pending: partial.pending ?? 0,
  });
}
