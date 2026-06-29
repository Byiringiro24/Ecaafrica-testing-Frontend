import { apiRequest } from "./api";
import type { Tablet, Device } from "./deviceApi";

// Re-export from deviceApi for backwards compatibility
export { deviceApi } from "./deviceApi";
export type { Tablet, Device } from "./deviceApi";

// Legacy types for backwards compatibility
export type LegacyTablet = {
  id: string;
  name: string;
  ip: string;
  port: number;
  deviceId?: string;
  location?: string;
  status: "online" | "offline" | "error";
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceStatus = {
  connected: boolean;
  success?: boolean;
  message?: string;
  handle?: number;
  deviceId?: string;
  ipAddress?: string;
  port?: number;
  serialNumber?: string;
  productName?: string;
  productCode?: string;
  users?: number;
  logs?: number;
  faces?: number;
  fingerprints?: number;
  cards?: number;
  passwords?: number;
};

export type DeviceUser = {
  userId: string;
  name: string;
  privilege: number;
  enabled: boolean;
  biometricMethods: string[];
};

export type FK623SyncRequest = {
  tabletId: string;
};

export type ConnectDeviceRequest = {
  tabletId: string;
  deviceId: string;
  ipAddress: string;
  port: number;
  license?: number;
};

export type PullLogsRequest = {
  tabletId: string;
  readMark?: number;
};

export type PushUserRequest = {
  tabletId: string;
  userId: string;
  name: string;
  privilege?: number;
  enabled?: boolean;
};

const unwrapDeviceStatus = (response: any): { data: DeviceStatus } => ({
  data: response?.data?.data ?? response?.data ?? response,
});

const unwrapDeviceResult = <T>(response: any): T => response?.data?.data ?? response?.data ?? response;

export const DEFAULT_FK623_CONFIG = {
  deviceId: import.meta.env.VITE_FK623_DEVICE_ID?.trim() || "DV-KGL-01",
  ipAddress: import.meta.env.VITE_FK623_DEVICE_IP?.trim() || "10.91.33.16",
  port: Number(import.meta.env.VITE_FK623_DEVICE_PORT || 5005),
  license: Number(import.meta.env.VITE_FK623_LICENSE || 1261),
};

// API client
export const tabletApi = {
  // Tablet management
  getAll: async () => {
    const response = await apiRequest<{ data?: Tablet[]; tablets?: Tablet[] }>("/tablets", {
      auth: "school",
    });

    return { tablets: response.tablets ?? response.data ?? [] };
  },
  
  create: (data: { name: string; ip: string; port: number; deviceId?: string; location?: string }) =>
    apiRequest<{ tablet: Tablet }>("/tablets", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),
  
  update: (id: string, data: Partial<Tablet>) =>
    apiRequest<{ tablet: Tablet }>(`/tablets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      auth: "school",
    }),
  
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/tablets/${id}`, {
      method: "DELETE",
      auth: "school",
    }),

  // FK623 Device operations
  getStatus: async (tabletId: string) => {
    const response = await apiRequest<any>(`/tablets/${tabletId}/device/status`, { auth: "school" });
    return unwrapDeviceStatus(response);
  },
  
  connect: async (data: ConnectDeviceRequest) => {
    const response = await apiRequest<any>(`/tablets/${data.tabletId}/device/connect`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    });
    return unwrapDeviceStatus(response);
  },
  
  disconnect: (tabletId: string) =>
    apiRequest<{ success: boolean }>(`/tablets/${tabletId}/device/disconnect`, {
      method: "POST",
      auth: "school",
    }),
  
  syncTime: (tabletId: string) =>
    apiRequest<{ success: boolean }>(`/tablets/${tabletId}/device/sync-time`, {
      method: "POST",
      auth: "school",
    }),
  
  setTime: (tabletId: string, datetime: string) =>
    apiRequest<{ success: boolean }>(`/tablets/${tabletId}/device/set-time`, {
      method: "POST",
      body: JSON.stringify({ datetime }),
      auth: "school",
    }),

  // User synchronization
  getUsers: (tabletId: string) =>
    apiRequest<any>(`/tablets/${tabletId}/device/users`, {
      auth: "school",
    }).then((response) => ({ data: unwrapDeviceResult<{ users: DeviceUser[]; count: number }>(response) })),
  
  pushUser: (data: PushUserRequest) =>
    apiRequest<{ success: boolean }>(`/tablets/${data.tabletId}/device/users`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),
  
  removeUser: (tabletId: string, userId: string) =>
    apiRequest<{ success: boolean }>(`/tablets/${tabletId}/device/users/${userId}`, {
      method: "DELETE",
      auth: "school",
    }),

  // Attendance log synchronization
  pullLogs: (data: PullLogsRequest) =>
    apiRequest<any>(
      `/tablets/${data.tabletId}/device/pull-logs`,
      {
        method: "POST",
        body: JSON.stringify({ readMark: data.readMark || 0 }),
        auth: "school",
      }
    ).then((response) => ({
      data: unwrapDeviceResult<{ savedCount: number; duplicateCount: number; count: number }>(response),
    })),
};
