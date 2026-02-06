import { SessionState } from "../services/SessionController";
import type { SessionData } from "../services/SessionController";

const VALID_STATES = new Set(Object.values(SessionState));

/**
 * Validates that an unknown value conforms to the SessionData interface.
 * Extracted from StateStore for reuse in IPC input validation.
 */
export function isValidSessionData(data: unknown): data is SessionData {
  if (data === null || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Required string fields
  if (typeof obj.id !== "string" || obj.id.length === 0) return false;
  if (typeof obj.state !== "string" || !VALID_STATES.has(obj.state as SessionState))
    return false;

  // Required number field
  if (typeof obj.stateEnteredAt !== "number") return false;

  // Nullable number fields
  if (obj.startedAt !== null && typeof obj.startedAt !== "number") return false;
  if (obj.stoppedAt !== null && typeof obj.stoppedAt !== "number") return false;

  // Nullable string fields
  if (obj.audioPath !== null && typeof obj.audioPath !== "string") return false;
  if (obj.transcript !== null && typeof obj.transcript !== "string") return false;
  if (obj.markdownOutput !== null && typeof obj.markdownOutput !== "string") return false;
  if (obj.reportPath !== null && typeof obj.reportPath !== "string") return false;
  if (obj.error !== null && typeof obj.error !== "string") return false;

  // Screenshots must be an array of strings
  if (!Array.isArray(obj.screenshots)) return false;
  if (!obj.screenshots.every((s: unknown) => typeof s === "string")) return false;

  return true;
}
