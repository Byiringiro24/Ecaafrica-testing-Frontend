import { localDateInputValue } from "./dateInput";

export type ApiStatus = "present" | "absent" | "late" | "excused";
export type UiStatus = "Present" | "Absent" | "Late" | "Excused";

export type ClassRecord = {
  id: string;
  name: string;
  level: number;
};

export type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
};

export type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: {
    id: string;
    name: string;
    full_name: string;
    class_id: string;
  } | null;
};

export type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
  session_type?: string | null;
  submitted_at?: string | null;
};

export type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: ApiStatus;
  scan_method?: string | null;
  scanned_at?: string | null;
  created_at?: string | null;
};

export const STATUS_LABEL: Record<ApiStatus, UiStatus> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export const STATUS_TO_API: Record<UiStatus, ApiStatus> = {
  Present: "present",
  Absent: "absent",
  Late: "late",
  Excused: "excused",
};

export const MANUAL_STATUS_CLASSES: Record<ApiStatus, string> = {
  present: "bg-success/15 text-success border-success/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  late: "bg-amber-100 text-amber-700 border-amber-200",
  excused: "bg-blue-100 text-blue-700 border-blue-200",
};

export const nextManualStatus = (current?: ApiStatus): ApiStatus => {
  const order: ApiStatus[] = ["present", "absent", "late", "excused"];
  if (!current) return order[0];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
};

export const formatLongDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const formatTime = (value?: string | null, status?: ApiStatus) => {
  if (!value || status === "absent") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

export const todayIso = () => localDateInputValue();
