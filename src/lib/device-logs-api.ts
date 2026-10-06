/**
 * API Service for Device Logs feature
 * Handles all API calls for the boarding device-logs page.
 *
 * Primary data source: /attendance/records/device-logs
 * (reads from attendance_logs table - populated automatically by the
 *  server-side pull-logs job every 5 minutes).
 */

import { apiRequest } from './api';
import type {
  AttendanceResponse,
  TodayAttendanceResponse,
  AttendanceStats,
  TabletsResponse,
  DeviceStatusResponse,
  DeviceLog
} from './device-logs-types';

// Types

export type DeviceLogQuery = {
  startDate?: string;
  endDate?: string;
  studentId?: string;
  deviceId?: string;
  method?: string;
  status?: string;
  syncState?: string;
  search?: string;
};

export type PullAllResult = {
  tablets: Array<{
    tabletId: string;
    tabletName: string;
    status: string;
    saved?: number;
    duplicates?: number;
    errors?: string[];
  }>;
  totalSaved: number;
  totalErrors: number;
  summary: string;
};

/**
 * Fetch device logs with filtering and pagination.
 * Reads from the attendance_logs table via the new /device-logs endpoint.
 */
export async function fetchDeviceLogs(params: DeviceLogQuery & {
  page?: number;
  limit?: number;
}): Promise<AttendanceResponse> {
  const q = new URLSearchParams();

  if (params.page) q.append('page', String(params.page));
  if (params.limit) q.append('limit', String(params.limit));
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);
  if (params.studentId) q.append('studentId', params.studentId);
  if (params.deviceId) q.append('deviceId', params.deviceId);
  if (params.method) q.append('method', params.method);
  if (params.status) q.append('status', params.status);
  if (params.syncState) q.append('syncState', params.syncState);
  if (params.search) q.append('search', params.search);

  const response = await apiRequest<{ data: DeviceLog[]; meta: any }>(
    `/attendance/records/device-logs?${q.toString()}`,
    { auth: 'school', returnMeta: true }
  );

  return {
    data: response.data ?? [],
    meta: response.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 }
  };
}

/** Fetch every device log matching the filters, across all API pages. */
export async function fetchAllDeviceLogs(params: DeviceLogQuery = {}): Promise<DeviceLog[]> {
  const pageSize = 200;
  const firstPage = await fetchDeviceLogs({ ...params, page: 1, limit: pageSize });
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
      fetchDeviceLogs({ ...params, page: index + 2, limit: pageSize })
    )
  );

  return [firstPage.data, ...remainingPages.map((page) => page.data)].flat();
}

/**
 * Fetch today's attendance logs from the attendance_logs table.
 */
export async function fetchTodayAttendance(): Promise<TodayAttendanceResponse> {
  const response = await apiRequest<DeviceLog[] | { data: DeviceLog[] }>(
    '/attendance/records/device-logs/today',
    { auth: 'school' }
  );

  return { data: Array.isArray(response) ? response : response.data ?? [] };
}

/**
 * Fetch attendance statistics from the attendance_logs table.
 */
export async function fetchAttendanceStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceStats> {
  const q = new URLSearchParams();
  if (params?.startDate) q.append('startDate', params.startDate);
  if (params?.endDate) q.append('endDate', params.endDate);

  const qs = q.toString();
  const url = `/attendance/records/device-logs/stats${qs ? '?' + qs : ''}`;

  const response = await apiRequest<AttendanceStats>(url, { auth: 'school' });
  return response as AttendanceStats;
}

/**
 * Fetch all tablets with optional filtering and pagination.
 */
export async function fetchTablets(params?: {
  status?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<TabletsResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.append('status', params.status);
  if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
  if (params?.page) q.append('page', String(params.page));
  if (params?.limit) q.append('limit', String(params.limit));

  const qs = q.toString();
  const url = `/tablets/device-logs/list${qs ? '?' + qs : ''}`;

  const response = await apiRequest<{ data: any[]; meta?: any }>(url, {
    auth: 'school',
    returnMeta: true
  });

  return {
    data: response.data ?? [],
    meta: response.meta
  };
}

/**
 * Fetch device connection statuses.
 */
export async function fetchDeviceStatus(tabletId?: string): Promise<DeviceStatusResponse> {
  const q = new URLSearchParams();
  if (tabletId) q.append('tabletId', tabletId);

  const qs = q.toString();
  const url = `/devices/status${qs ? '?' + qs : ''}`;

  const response = await apiRequest<{ data: any[] }>(url, { auth: 'school' });
  return { data: response.data ?? [] };
}

/**
 * Trigger an immediate pull from all active, online tablets for this school.
 * Used by the "Sync Now" button on the device-logs page.
 */
export async function pullAllLogs(): Promise<PullAllResult> {
  const response = await apiRequest<PullAllResult>(
    '/tablets/pull-all-logs',
    { method: 'POST', auth: 'school' }
  );
  return response as PullAllResult;
}
