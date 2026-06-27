/**
 * API Service for Device Logs feature
 * Handles all API calls for the boarding device-logs page
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

/**
 * Fetch device logs with filtering and pagination
 */
export async function fetchDeviceLogs(params: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  studentId?: string;
  deviceId?: string;
  method?: string;
  status?: string;
  syncState?: string;
  search?: string;
}): Promise<AttendanceResponse> {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', String(params.page));
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  if (params.studentId) queryParams.append('studentId', params.studentId);
  if (params.deviceId) queryParams.append('deviceId', params.deviceId);
  if (params.method) queryParams.append('method', params.method);
  if (params.status) queryParams.append('status', params.status);
  if (params.syncState) queryParams.append('syncState', params.syncState);
  if (params.search) queryParams.append('search', params.search);

  const response = await apiRequest<{ data: DeviceLog[]; meta: any }>(
    `/attendance/records/logs?${queryParams.toString()}`,
    {
      auth: 'school',
      returnMeta: true
    }
  );

  return {
    data: response.data,
    meta: response.meta
  };
}

/**
 * Fetch today's attendance logs
 */
export async function fetchTodayAttendance(): Promise<TodayAttendanceResponse> {
  const response = await apiRequest<{ data: DeviceLog[] }>(
    '/attendance/records/today',
    {
      auth: 'school'
    }
  );

  return {
    data: response.data
  };
}

/**
 * Fetch attendance statistics
 */
export async function fetchAttendanceStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceStats> {
  const queryParams = new URLSearchParams();
  
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);

  const query = queryParams.toString();
  const url = query ? `/attendance/records/stats?${query}` : '/attendance/records/stats';

  const response = await apiRequest<{ data: AttendanceStats }>(url, {
    auth: 'school'
  });

  return response.data;
}

/**
 * Fetch all tablets with optional filtering and pagination
 */
export async function fetchTablets(params?: {
  status?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<TabletsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.status) queryParams.append('status', params.status);
  if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));

  const query = queryParams.toString();
  const url = query ? `/tablets/device-logs/list?${query}` : '/tablets/device-logs/list';

  const response = await apiRequest<{ data: any[]; meta?: any }>(url, {
    auth: 'school',
    returnMeta: true
  });

  return {
    data: response.data,
    meta: response.meta
  };
}

/**
 * Fetch device connection statuses
 */
export async function fetchDeviceStatus(tabletId?: string): Promise<DeviceStatusResponse> {
  const queryParams = new URLSearchParams();
  
  if (tabletId) queryParams.append('tabletId', tabletId);

  const query = queryParams.toString();
  const url = query ? `/devices/status?${query}` : '/devices/status';

  const response = await apiRequest<{ data: any[] }>(url, {
    auth: 'school'
  });

  return {
    data: response.data
  };
}
