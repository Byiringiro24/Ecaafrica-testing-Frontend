import { apiRequest } from "./api";

// Types for Devices
export type Device = {
  id: string;
  school_id: string;
  device_uid: string;
  name: string;
  type: "tablet" | "kiosk" | "web";
  location?: string | null;
  mode: "gate" | "boarding" | "classroom";
  is_active: boolean;
  last_seen_at?: string | null;
  firmware_version?: string | null;
  created_at: string;
  updated_at: string;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  last_status_message?: string | null;
  api_url?: string | null;
  tablet_ip?: string | null;
  tablet_port?: number | null;
  last_sync_at?: string | null;
  attendance_config?: any;
  connection_error?: string | null;
  device_logs_count?: number;
  device_serial?: string | null;
  device_users_count?: number;
  is_connected: boolean;
  last_connection_at?: string | null;
  license_number?: number | null;
  product_code?: string | null;
  product_name?: string | null;
  tablet_id?: string | null;
  status: string;
  is_online: boolean;
};

export type Tablet = {
  id: string;
  school_id: string;
  uuid: string;
  name: string;
  ip: string;
  port: number;
  deviceId?: string;
  url: string;
  status: "online" | "offline" | "error" | "maintenance";
  last_health_check?: string | null;
  lastSync?: string | null;
  health_check_interval: number;
  firmware_version?: string | null;
  os_info?: string | null;
  location?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type AttendanceSession = {
  name: string;
  rules: AttendanceRule[];
};

export type AttendanceRule = {
  label?: string;
  start: string;
  end: string;
};

export type AttendanceConfig = {
  sessions: AttendanceSession[];
};

export type CreateDeviceRequest = {
  device_uid: string;
  name: string;
  type?: "tablet" | "kiosk" | "web";
  location?: string;
  mode?: "gate" | "boarding" | "classroom";
  pin?: string;
  firmware_version?: string;
  tablet_ip?: string;
  tablet_port?: number;
};

export type CreateTabletRequest = {
  name: string;
  ip: string;
  port: number;
  location?: string;
  notes?: string;
  firmware_version?: string;
  os_info?: string;
};

export type UpdateDeviceRequest = {
  name?: string;
  type?: "tablet" | "kiosk" | "web";
  location?: string | null;
  mode?: "gate" | "boarding" | "classroom";
  pin?: string;
  is_active?: boolean;
  firmware_version?: string | null;
};

export type UpdateTabletRequest = {
  name?: string;
  ip?: string;
  port?: number;
  location?: string | null;
  notes?: string | null;
  firmware_version?: string | null;
  os_info?: string | null;
  is_active?: boolean;
};

export type PushStudentsRequest = {
  mode?: "selected" | "class" | "all";
  student_ids?: (string | number)[];
  section_id?: string | number;
  class_id?: string | number;
};

// Device API
export const deviceApi = {
  // List all devices
  getAll: (params?: { page?: number; limit?: number; mode?: string; type?: string; is_active?: boolean }) =>
    apiRequest<{ data: Device[]; meta: { page: number; limit: number; total: number } }>(
      `/devices?${new URLSearchParams(params as any).toString()}`,
      { auth: "school" }
    ),

  // Get single device
  get: (id: string) =>
    apiRequest<Device>(`/devices/${id}`, { auth: "school" }),

  // Create new device
  create: (data: CreateDeviceRequest) =>
    apiRequest<Device>("/devices", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  // Update device
  update: (id: string, data: UpdateDeviceRequest) =>
    apiRequest<Device>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: "school",
    }),

  // Deactivate device
  deactivate: (id: string) =>
    apiRequest<Device>(`/devices/${id}/deactivate`, {
      method: "PATCH",
      auth: "school",
    }),

  // Delete device
  delete: (id: string) =>
    apiRequest<void>(`/devices/${id}`, {
      method: "DELETE",
      auth: "school",
    }),

  // Push students to device
  pushStudents: (id: string, data: PushStudentsRequest) =>
    apiRequest<{ device_id: string; target: any; pushed_count: number; students: any[] }>(
      `/devices/${id}/push-students`,
      {
        method: "POST",
        body: JSON.stringify(data),
        auth: "school",
      }
    ),

  // Get device status
  getStatus: (id: string) =>
    apiRequest<any>(`/devices/${id}/status`, { auth: "school" }),

  // Get device attendance config
  getAttendanceConfig: (id: string) =>
    apiRequest<{ device_id: string; sessions: AttendanceSession[]; attendance_config: AttendanceConfig }>(
      `/devices/${id}/attendance-config`,
      { auth: "school" }
    ),

  // Save device attendance config
  saveAttendanceConfig: (id: string, data: AttendanceConfig) =>
    apiRequest<{ device_id: string; sessions: AttendanceSession[]; attendance_config: AttendanceConfig }>(
      `/devices/${id}/attendance-config`,
      {
        method: "POST",
        body: JSON.stringify(data),
        auth: "school",
      }
    ),

  // Get device logs
  getLogs: (id: string, params?: { page?: number; limit?: number }) =>
    apiRequest<{ data: any[]; meta: any }>(
      `/devices/${id}/logs?${new URLSearchParams(params as any).toString()}`,
      { auth: "school" }
    ),
};

// Tablet API
export const tabletApi = {
  // List all tablets
  getAll: (params?: { page?: number; limit?: number; status?: string; is_active?: boolean }) =>
    apiRequest<{ data: Tablet[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/tablets?${new URLSearchParams(params as any).toString()}`,
      { auth: "school" }
    ),

  // Get single tablet
  get: (id: string) =>
    apiRequest<{ tablet: Tablet }>(`/tablets/${id}`, { auth: "school" }),

  // Create new tablet
  create: (data: CreateTabletRequest) =>
    apiRequest<{ tablet: Tablet }>("/tablets", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  // Update tablet
  update: (id: string, data: UpdateTabletRequest) =>
    apiRequest<{ tablet: Tablet }>(`/tablets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: "school",
    }),

  // Update tablet status
  updateStatus: (id: string, status: "online" | "offline" | "error" | "maintenance") =>
    apiRequest<{ tablet: Tablet }>(`/tablets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      auth: "school",
    }),

  // Delete tablet
  delete: (id: string) =>
    apiRequest<void>(`/tablets/${id}`, {
      method: "DELETE",
      auth: "school",
    }),

  // Check tablet health
  checkHealth: (id: string) =>
    apiRequest<any>(`/tablets/${id}/health`, { auth: "school" }),
};
