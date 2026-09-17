/**
 * Boarding Management API client
 * All calls use school-scoped auth.
 */
import { apiRequest } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeaveState =
  | "draft" | "requested" | "pending_dod_approval" | "approved"
  | "rejected" | "awaiting_physical_exit" | "outside_school"
  | "returned" | "closed" | "cancelled";

export type LeaveCategory = "short_leave" | "long_leave" | "medical_leave" | "emergency_leave";

export type LeaveRecord = {
  id: string;
  student_id: string;
  parent_id?: string | null;
  leave_type: string;
  leave_state: LeaveState;
  leave_category: LeaveCategory;
  start_date: string;
  start_time?: string | null;
  end_date: string;
  expected_return_time?: string | null;
  destination?: string | null;
  reason?: string | null;
  medical_notes?: string | null;
  supporting_doc_url?: string | null;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  exited_at?: string | null;
  returned_at?: string | null;
  gate_keeper_id?: string | null;
  late_return_flagged: boolean;
  actual_duration_mins?: number | null;
  approved_duration_mins?: number | null;
  is_unauthorized: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovedExit = {
  leave_id: string;
  leave_state: LeaveState;
  leave_type: string;
  leave_category: LeaveCategory;
  start_date: string;
  end_date: string;
  expected_return_time?: string | null;
  destination?: string | null;
  reason?: string | null;
  approved_at?: string | null;
  exited_at?: string | null;
  exit_record?: { exit_at: string; gate_keeper_id?: string | null } | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    student_id_number?: string | null;
    photo_url?: string | null;
    gender?: string | null;
    boarding_status?: string | null;
    dormitory?: { id: string; name: string; block_name?: string | null } | null;
    room?: { id: string; room_number: string } | null;
  };
};

export type BoardingWindow = {
  id: string;
  name: string;
  dormitory_id?: string | null;
  dormitory?: { id: string; name: string } | null;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  escalation_mins: number;
  is_active: boolean;
  applicable_days: string;
};

export type BoardingSession = {
  id: string;
  dormitory_id?: string | null;
  dormitory?: { id: string; name: string; block_name?: string | null } | null;
  session_date: string;
  reconciled_at?: string | null;
  total_expected: number;
  total_present: number;
  total_late: number;
  total_on_leave: number;
  total_missing: number;
};

export type BoardingConfig = {
  require_student_photo: boolean;
  require_biometric_return: boolean;
  require_gate_exit_confirm: boolean;
  parent_escalation_mins: number;
  late_return_threshold_mins: number;
  max_short_leave_hours: number;
  max_long_leave_days: number;
  sms_on_leave_approval: boolean;
  sms_on_long_leave: boolean;
  sms_on_medical_leave: boolean;
  sms_on_missing_attendance: boolean;
  sms_on_late_return: boolean;
};

export type PatronAssignment = {
  id: string;
  user_id: string;
  dormitory_id: string;
  dormitory?: { id: string; name: string; gender?: string; block_name?: string | null; hostel_name?: string | null } | null;
  user?: { id: string; name: string; email: string; role: string } | null;
  is_active: boolean;
  assigned_at: string;
};

export type DiningMenu = {
  id: string;
  name: string;
  menu_type: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  items: DiningMenuItem[];
};

export type DiningMenuItem = {
  id: string;
  menu_id: string;
  day_of_week: number;
  meal_type: string;
  items: string;
  notes?: string | null;
};

export type DiningSchedule = {
  id: string;
  scope: string;
  dormitory_id?: string | null;
  dormitory?: { id: string; name: string } | null;
  meal_type: string;
  start_time: string;
  end_time: string;
  applicable_days: string;
  is_active: boolean;
};

export type DiningSession = {
  id: string;
  dormitory_id?: string | null;
  meal_type: string;
  session_date: string;
  opened_at?: string | null;
  closed_at?: string | null;
};

export type DiningRosterItem = {
  student: {
    id: string; first_name: string; last_name: string; full_name: string;
    student_id_number?: string | null; photo_url?: string | null;
    boarding_status?: string | null;
  };
  is_on_leave: boolean;
  attendance_status?: string | null;
};

// ── Leaves API ────────────────────────────────────────────────────────────────

export const leavesApi = {
  list: (params?: Record<string, string>) =>
    apiRequest<{ data: LeaveRecord[]; meta: any }>(
      `/boarding/leaves?${new URLSearchParams(params).toString()}`,
      { auth: "school" }
    ),

  get: (id: string) =>
    apiRequest<LeaveRecord>(`/boarding/leaves/${id}`, { auth: "school" }),

  create: (data: Record<string, unknown>) =>
    apiRequest<LeaveRecord>("/boarding/leaves", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  approve: (id: string) =>
    apiRequest<LeaveRecord>(`/boarding/leaves/${id}/approve`, {
      method: "PATCH",
      auth: "school",
    }),

  reject: (id: string, reason: string) =>
    apiRequest<LeaveRecord>(`/boarding/leaves/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
      auth: "school",
    }),

  confirmExit: (id: string, notes?: string) =>
    apiRequest<LeaveRecord>(`/boarding/leaves/${id}/confirm-exit`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
      auth: "school",
    }),

  // Patron/Matron confirms student biometric return (RETURNED -> CLOSED, spec §21)
  confirmReturn: (id: string) =>
    apiRequest<LeaveRecord>(`/boarding/leaves/${id}/confirm-return`, {
      method: "PATCH",
      auth: "school",
    }),

  getApprovedExits: (date?: string) =>
    apiRequest<ApprovedExit[]>(
      `/boarding/leaves/approved-exits${date ? `?date=${date}` : ""}`,
      { auth: "school" }
    ),
};

// ── Boarding Attendance API ───────────────────────────────────────────────────

export const boardingAttendanceApi = {
  getConfig: () =>
    apiRequest<BoardingConfig>("/boarding/attendance/config", { auth: "school" }),

  updateConfig: (data: Partial<BoardingConfig>) =>
    apiRequest<BoardingConfig>("/boarding/attendance/config", {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: "school",
    }),

  listWindows: (dormitoryId?: string) =>
    apiRequest<BoardingWindow[]>(
      `/boarding/attendance/windows${dormitoryId ? `?dormitory_id=${dormitoryId}` : ""}`,
      { auth: "school" }
    ),

  createWindow: (data: Record<string, unknown>) =>
    apiRequest<BoardingWindow>("/boarding/attendance/windows", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  updateWindow: (id: string, data: Record<string, unknown>) =>
    apiRequest<BoardingWindow>(`/boarding/attendance/windows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: "school",
    }),

  deleteWindow: (id: string) =>
    apiRequest<BoardingWindow>(`/boarding/attendance/windows/${id}`, {
      method: "DELETE",
      auth: "school",
    }),

  openSession: (dormitory_id: string, session_date: string, window_id?: string, extra?: Record<string, unknown>) =>
    apiRequest<BoardingSession>("/boarding/attendance/sessions", {
      method: "POST",
      body: JSON.stringify({ dormitory_id, session_date, window_id, ...extra }),
      auth: "school",
    }),

  getSessionSummary: (id: string) =>
    apiRequest<BoardingSession & { records: any[] }>(`/boarding/attendance/sessions/${id}`, {
      auth: "school",
    }),

  reconcile: (id: string) =>
    apiRequest<BoardingSession>(`/boarding/attendance/sessions/${id}/reconcile`, {
      method: "POST",
      auth: "school",
    }),

  correctAttendance: (sessionId: string, student_id: string, status: string, reason: string) =>
    apiRequest<any>(`/boarding/attendance/sessions/${sessionId}/correct`, {
      method: "PATCH",
      body: JSON.stringify({ student_id, status, reason }),
      auth: "school",
    }),
};

// ── Patron/Matron API ─────────────────────────────────────────────────────────

export const patronApi = {
  listPatronAssignments: (userId: string) =>
    apiRequest<PatronAssignment[]>(`/boarding/patrons/${userId}/assignments`, { auth: "school" }),

  listDormitoryPatrons: (dormitoryId: string) =>
    apiRequest<PatronAssignment[]>(`/boarding/patrons/dormitory/${dormitoryId}`, { auth: "school" }),

  assign: (userId: string, dormitory_ids: string[]) =>
    apiRequest<PatronAssignment[]>(`/boarding/patrons/${userId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ dormitory_ids }),
      auth: "school",
    }),

  remove: (userId: string, dormitoryId: string) =>
    apiRequest<PatronAssignment>(`/boarding/patrons/${userId}/dormitory/${dormitoryId}`, {
      method: "DELETE",
      auth: "school",
    }),
};

// ── Dining API ────────────────────────────────────────────────────────────────

export const diningApi = {
  listMenus: () =>
    apiRequest<DiningMenu[]>("/boarding/dining/menus", { auth: "school" }),

  createMenu: (data: Record<string, unknown>) =>
    apiRequest<DiningMenu>("/boarding/dining/menus", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  addMenuItems: (menuId: string, items: DiningMenuItem[]) =>
    apiRequest<DiningMenuItem[]>(`/boarding/dining/menus/${menuId}/items`, {
      method: "POST",
      body: JSON.stringify({ items }),
      auth: "school",
    }),

  listSchedules: (dormitoryId?: string) =>
    apiRequest<DiningSchedule[]>(
      `/boarding/dining/schedules${dormitoryId ? `?dormitory_id=${dormitoryId}` : ""}`,
      { auth: "school" }
    ),

  createSchedule: (data: Record<string, unknown>) =>
    apiRequest<DiningSchedule>("/boarding/dining/schedules", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  openSession: (data: Record<string, unknown>) =>
    apiRequest<DiningSession>("/boarding/dining/sessions", {
      method: "POST",
      body: JSON.stringify(data),
      auth: "school",
    }),

  getRoster: (sessionId: string) =>
    apiRequest<DiningRosterItem[]>(`/boarding/dining/sessions/${sessionId}/roster`, {
      auth: "school",
    }),

  markAttendance: (sessionId: string, marks: Array<{ student_id: string; status: string }>) =>
    apiRequest<any>(`/boarding/dining/sessions/${sessionId}/attendance`, {
      method: "POST",
      body: JSON.stringify({ marks }),
      auth: "school",
    }),

  closeSession: (sessionId: string) =>
    apiRequest<any>(`/boarding/dining/sessions/${sessionId}/close`, {
      method: "POST",
      auth: "school",
    }),
};

// ── Device assignment API ─────────────────────────────────────────────────────

export const deviceLocationApi = {
  list: (params?: { dormitory_id?: string; location_scope?: string }) =>
    apiRequest<any[]>(
      `/devices/locations?${new URLSearchParams(params as any).toString()}`,
      { auth: "school" }
    ),

  assign: (deviceId: string, data: {
    location_scope?: string;
    dormitory_id?: string | null;
    location_label?: string | null;
    auto_push?: boolean;
    group?: number;
  }) =>
    apiRequest<any>(`/devices/${deviceId}/assign-location`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: "school",
    }),

  getAssignedStudents: (deviceId: string) =>
    apiRequest<any>(`/devices/${deviceId}/assigned-students`, { auth: "school" }),

  pushGroup: (deviceId: string, group: number) =>
    apiRequest<any>(`/devices/${deviceId}/push-group`, {
      method: "POST",
      body: JSON.stringify({ group }),
      auth: "school",
    }),

  listWithLocation: (params?: { dormitory_id?: string; location_scope?: string }) =>
    apiRequest<any>(`/devices/locations${params ? `?${new URLSearchParams(params as any)}` : ""}`, { auth: "school" }),
};
