import { apiRequest } from "./api";

type Tablet = {
  id: string;
  status?: string | null;
  is_active?: boolean | null;
};

export type SyncSummary = {
  checked: number;
  pulled: number;
  saved: number;
  attendanceRecords: number;
  duplicates: number;
  errors: string[];
};

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

export async function syncLiveAttendanceFromTablets(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    checked: 0,
    pulled: 0,
    saved: 0,
    attendanceRecords: 0,
    duplicates: 0,
    errors: [],
  };

  const tabletPayload = await apiRequest<unknown>("/tablets?limit=500", { auth: "school" });
  const tablets = unwrapTablets(tabletPayload).filter((tablet) => tablet.is_active !== false);
  summary.checked = tablets.length;

  await Promise.all(
    tablets.map(async (tablet) => {
      try {
        const statusPayload = await apiRequest<unknown>(`/tablets/${tablet.id}/device/status`, {
          auth: "school",
        });
        const status = (statusPayload as { data?: any })?.data ?? statusPayload;
        const connected = Boolean((status as any)?.connected ?? (status as any)?.data?.connected);

        if (!connected && tablet.status !== "online") return;

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
    })
  );

  return summary;
}
