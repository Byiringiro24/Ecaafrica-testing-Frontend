/**
 * liveAttendanceSync.ts
 *
 * The server now automatically pulls logs from all devices every 5 minutes
 * via the pull-logs.job.ts background job. This module is retained for
 * compatibility but delegates to the server-side pull endpoint.
 *
 * Call `syncLiveAttendanceFromTablets({ force: true })` to trigger an
 * immediate pull (e.g., on page load or after a user action).
 */

import { apiRequest } from "./api";

const LIVE_ATTENDANCE_SYNC_MIN_MS = 5 * 60_000; // respect server cadence
let lastLiveAttendanceSyncAt = 0;
let liveAttendanceSyncInFlight: Promise<SyncSummary> | null = null;

export type SyncSummary = {
  checked: number;
  pulled: number;
  saved: number;
  attendanceRecords: number;
  duplicates: number;
  errors: string[];
};

const emptySummary = (): SyncSummary => ({
  checked: 0,
  pulled: 0,
  saved: 0,
  attendanceRecords: 0,
  duplicates: 0,
  errors: []
});

/**
 * Trigger an immediate server-side pull from all active tablets.
 * Throttled to once per server pull interval unless `force: true` is passed.
 */
export async function syncLiveAttendanceFromTablets(
  options: { force?: boolean } = {}
): Promise<SyncSummary> {
  const now = Date.now();
  if (!options.force && now - lastLiveAttendanceSyncAt < LIVE_ATTENDANCE_SYNC_MIN_MS) {
    return emptySummary();
  }
  if (liveAttendanceSyncInFlight) return liveAttendanceSyncInFlight;

  liveAttendanceSyncInFlight = runSync().finally(() => {
    lastLiveAttendanceSyncAt = Date.now();
    liveAttendanceSyncInFlight = null;
  });

  return liveAttendanceSyncInFlight;
}

async function runSync(): Promise<SyncSummary> {
  try {
    const result = await apiRequest<{
      tablets?: Array<{ saved?: number; duplicates?: number; errors?: string[] }>;
      totalSaved?: number;
    }>("/tablets/pull-all-logs", { method: "POST", auth: "school" });

    const tablets = result?.tablets ?? [];
    return {
      checked: tablets.length,
      pulled: tablets.filter((t) => (t.saved ?? 0) > 0).length,
      saved: result?.totalSaved ?? 0,
      attendanceRecords: result?.totalSaved ?? 0,
      duplicates: tablets.reduce((s, t) => s + (t.duplicates ?? 0), 0),
      errors: tablets.flatMap((t) => t.errors ?? [])
    };
  } catch {
    return emptySummary();
  }
}
