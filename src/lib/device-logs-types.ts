/**
 * TypeScript interfaces for the Device Logs feature
 * Used by the boarding device-logs page for displaying attendance data from biometric devices
 */

// Biometric authentication methods
export type BiometricMethod = 'Fingerprint' | 'Password/PIN' | 'RFID Card' | 'Face Recognition' | 'Unknown';

// Movement direction
export type Direction = 'In' | 'Out' | 'Unknown';

// Attendance status
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused' | 'Not scheduled';

// Sync state
export type SyncState = 'Synced' | 'Queued' | 'Failed';

// Device types
export type DeviceType = 'tablet' | 'fingerprint' | 'face' | 'rfid';

// Device modes
export type DeviceMode = 'gate' | 'classroom' | 'boarding';

// Tablet status
export type TabletStatus = 'online' | 'offline' | 'error' | 'maintenance';

// Device Log entry from gate_logs table
export interface DeviceLog {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string; // ISO datetime
  method: BiometricMethod; // normalized value
  methodRaw: string; // original value from device
  direction: Direction; // normalized value
  directionRaw: string; // original value from device
  className?: string;
  section?: string;
  club?: string;
  deviceId: string;
  tabletId?: string;
  status: string; // AttendanceStatus as string
  syncState: SyncState;
  sessionName?: string;
  statusLabel?: string;
  flagged: boolean;
  flagReason?: string;
  syncedAt?: string;
}

// Device entity from devices table
export interface Device {
  id: string;
  name: string;
  deviceUid: string;
  type: DeviceType;
  location?: string;
  mode: DeviceMode;
  isActive: boolean;
  isConnected: boolean;
  lastConnectionAt?: string;
  lastSeenAt?: string;
  tabletId?: string;
  serialNumber?: string;
  productName?: string;
}

// Tablet entity from tablets table
export interface Tablet {
  id: string;
  name: string;
  uuid?: string;
  ip?: string;
  port?: number;
  url?: string;
  status: TabletStatus;
  lastHealthCheck?: string;
  location?: string;
  isActive?: boolean;
  firmwareVersion?: string;
}

// Device status with connection info
export interface DeviceStatus {
  deviceId: string;
  name: string;
  serialNumber?: string;
  ipAddress?: string;
  isConnected: boolean;
  lastConnectionAt?: string;
  connectionError?: string;
}

// Filter state for device logs page
export interface FilterState {
  deviceId: string;
  method: string;
  status: string;
  syncState: string;
  searchText: string;
}

// Pagination state
export interface PaginationState {
  page: number;
  limit: number;
}

// API Response interfaces

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttendanceResponse {
  data: DeviceLog[];
  meta: PaginationMeta;
}

export interface TodayAttendanceResponse {
  data: DeviceLog[];
}

export interface AttendanceStats {
  totalRecords: number;
  uniqueStudents: number;
  fingerprintCount: number;
  faceCount: number;
  cardCount: number;
  passwordCount: number;
  checkInCount: number;
  checkOutCount: number;
}

export interface TabletsResponse {
  data: Tablet[];
  meta?: PaginationMeta;
}

export interface DeviceStatusResponse {
  data: DeviceStatus[];
}

// Today's stats for summary cards
export interface TodayStats {
  uniqueStudents: number;
  checkIns: number;
  checkOuts: number;
}
