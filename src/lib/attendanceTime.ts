export const ATTENDANCE_TIME_ZONE = "Africa/Kampala";

export const attendanceDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export const formatAttendanceDateTime = (value?: string | null) => {
  if (!value) return "Not submitted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: ATTENDANCE_TIME_ZONE, dateStyle: "short", timeStyle: "short", hour12: false }).format(date);
};

export const formatAttendanceTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: ATTENDANCE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
};
