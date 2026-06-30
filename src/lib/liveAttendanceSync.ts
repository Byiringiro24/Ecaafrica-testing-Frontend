import { apiRequest } from "./api";

type Tablet = {
  id: string;
  status?: string | null;
  is_active?: boolean | null;
};

const LIVE_ATTENDANCE_SYNC_MIN_MS = 20 * 60_000;
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
  errors: [],
});

const unwrapTablets = (payload: unknown): Tablet[] => {
  if (Array.isArray(payload)) return payload as Tablet[];
  const data = (payload as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as Tablet[];
  return [];
};

const unwrapPullResult = (payload: unknown) => {
  const nested = (payload as { data?: unknown })?.data ?? payload;
  return (nested as { data?: unknown })?.data ?? nested;
};

export async function syncLiveAttendanceFromTablets(options: { force?: boolean } = {}): Promise<SyncSummary> {
  const now = Date.now();
  if (!options.force && now - lastLiveAttendanceSyncAt < LIVE_ATTENDANCE_SYNC_MIN_MS) {
    return emptySummary();
  }
  if (liveAttendanceSyncInFlight) return liveAttendanceSyncInFlight;

  liveAttendanceSyncInFlight = runLiveAttendanceSync().finally(() => {
    lastLiveAttendanceSyncAt = Date.now();
    liveAttendanceSyncInFlight = null;
  });

  return liveAttendanceSyncInFlight;
}

async function runLiveAttendanceSync(): Promise<SyncSummary> {
  const summary = emptySummary();

  const tabletPayload = await apiRequest<unknown>("/tablets?limit=500", { auth: "school" });
  const tablets = unwrapTablets(tabletPayload).filter((tablet) => tablet.is_active !== false);
  summary.checked = tablets.length;

  for (const tablet of tablets) {
    try {
      const connected = tablet.status === "online";
      if (!connected) {
        const statusPayload = await apiRequest<unknown>(`/tablets/${tablet.id}/device/status`, {
          auth: "school",
        });
        const status = (statusPayload as { data?: any })?.data ?? statusPayload;
        if (!Boolean((status as any)?.connected ?? (status as any)?.data?.connected)) continue;
      }

      const pullPayload = await apiRequest<unknown>(`/tablets/${tablet.id}/device/pull-logs`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ readMark: 0 }),
      });
      const pull = unwrapPullResult(pullPayload) as {
        savedCount?: number;
        attendanceRecordCount?: number;
        duplicateCount?: number;
        errors?: string[];
      };

      summary.pulled += 1;
      summary.saved += Number(pull.savedCount ?? 0);
      summary.attendanceRecords += Number(pull.attendanceRecordCount ?? 0);
      summary.duplicates += Number(pull.duplicateCount ?? 0);
      if (Array.isArray(pull.errors)) summary.errors.push(...pull.errors);
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : "Failed to sync tablet");
    }
  }

  return summary;
}
