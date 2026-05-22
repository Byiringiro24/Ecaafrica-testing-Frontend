// Mock data specific to Teacher and Staff panels.
// Additive — does not touch existing mockData.ts exports.
import { STUDENTS, CLASSES } from "./mockData";

export interface TeacherUser {
  id: string;
  name: string;
  initials: string;
  subject: string;
  classes: string[];
  classTeacher: string;
  phone: string;
  email: string;
  employeeId: string;
  department: string;
  dateJoined: string;
}

export const TEACHER_ME: TeacherUser = {
  id: "T001",
  name: "Mr. Habimana Eric",
  initials: "HE",
  subject: "Mathematics",
  classes: ["S4A", "S4B", "S5A", "S5B", "S6A", "S6B"],
  classTeacher: "S4A",
  phone: "+250 788 123 456",
  email: "e.habimana@gspk.rw",
  employeeId: "EMP-2021-014",
  department: "Sciences",
  dateJoined: "2021-09-01",
};

export interface ScheduleEntry {
  period: number;
  time: string;
  class: string;
  subject: string;
  room: string;
  status: "done" | "ongoing" | "upcoming";
  day?: string;
}

export const TODAY_SCHEDULE: ScheduleEntry[] = [
  { period: 1, time: "07:00–07:45", class: "S4A", subject: "Mathematics", room: "Room 12", status: "done" },
  { period: 2, time: "07:45–08:30", class: "S5B", subject: "Mathematics", room: "Room 8", status: "done" },
  { period: 3, time: "08:30–09:15", class: "S4B", subject: "Mathematics", room: "Room 14", status: "ongoing" },
  { period: 4, time: "09:15–10:00", class: "S6A", subject: "Mathematics", room: "Room 3", status: "upcoming" },
  { period: 5, time: "10:30–11:15", class: "S5A", subject: "Mathematics", room: "Room 11", status: "upcoming" },
  { period: 6, time: "11:15–12:00", class: "S6B", subject: "Mathematics", room: "Room 5", status: "upcoming" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const WEEK_SCHEDULE: ScheduleEntry[] = [];
DAYS.forEach((day, di) => {
  TODAY_SCHEDULE.forEach((s, si) => {
    WEEK_SCHEDULE.push({
      ...s,
      day,
      class: TEACHER_ME.classes[(di + si) % TEACHER_ME.classes.length],
      status: "upcoming",
    });
  });
});

export interface Exam {
  id: string;
  name: string;
  class: string;
  subject: string;
  date: string;
  duration: number;
  maxMarks: number;
  type: "CAT" | "Main Exam" | "Mock" | "Quiz";
  status: "Scheduled" | "Ongoing" | "Completed" | "Published";
  averageScore?: number;
  passRate?: number;
}

export const EXAMS: Exam[] = [
  { id: "EX-001", name: "Term 2 CAT 1", class: "S4A", subject: "Mathematics", date: "2026-05-20", duration: 60, maxMarks: 50, type: "CAT", status: "Scheduled" },
  { id: "EX-002", name: "Term 2 CAT 1", class: "S4B", subject: "Mathematics", date: "2026-05-21", duration: 60, maxMarks: 50, type: "CAT", status: "Scheduled" },
  { id: "EX-003", name: "Mid-Term Exam", class: "S5A", subject: "Mathematics", date: "2026-05-10", duration: 120, maxMarks: 100, type: "Main Exam", status: "Published", averageScore: 68, passRate: 82 },
  { id: "EX-004", name: "Quiz 3", class: "S6A", subject: "Mathematics", date: "2026-05-12", duration: 30, maxMarks: 20, type: "Quiz", status: "Completed", averageScore: 14, passRate: 78 },
  { id: "EX-005", name: "Mock Exam", class: "S6B", subject: "Mathematics", date: "2026-05-08", duration: 180, maxMarks: 100, type: "Mock", status: "Published", averageScore: 62, passRate: 71 },
];

export function gradeForScore(score: number, max: number): { grade: string; label: string; color: string } {
  const pct = (score / max) * 100;
  if (pct >= 80) return { grade: "A", label: "Distinction", color: "text-indigo-700 bg-indigo-50" };
  if (pct >= 70) return { grade: "B", label: "Merit", color: "text-blue-600 bg-blue-50" };
  if (pct >= 60) return { grade: "C", label: "Credit", color: "text-indigo-700 bg-indigo-50" };
  if (pct >= 50) return { grade: "D", label: "Pass", color: "text-amber-600 bg-amber-50" };
  return { grade: "F", label: "Fail", color: "text-red-600 bg-red-50" };
}

export interface ParentMessage {
  id: string;
  parentName: string;
  studentName: string;
  studentClass: string;
  phone: string;
  preview: string;
  unread: boolean;
  timestamp: string;
  thread: { from: "teacher" | "parent"; text: string; time: string }[];
}

export const PARENT_MESSAGES: ParentMessage[] = [
  {
    id: "M1", parentName: "Uwimana Bernard", studentName: "Uwimana Jean Paul", studentClass: "S4A",
    phone: "+250 788 234 567", preview: "Thank you for the update on Jean's progress...",
    unread: true, timestamp: "10 min ago",
    thread: [
      { from: "teacher", text: "Murakoze. Jean Paul has been doing very well in Math this term.", time: "Yesterday 14:20" },
      { from: "parent", text: "Thank you for the update on Jean's progress. We will continue supporting him at home.", time: "10 min ago" },
    ],
  },
  {
    id: "M2", parentName: "Mukamana Solange", studentName: "Mukamana Diane", studentClass: "S4A",
    phone: "+250 722 345 678", preview: "When is the next parent meeting?",
    unread: true, timestamp: "1 hr ago",
    thread: [
      { from: "parent", text: "Mwiriwe Mwarimu. When is the next parent meeting?", time: "1 hr ago" },
    ],
  },
  {
    id: "M3", parentName: "Bizimana Alexis", studentName: "Bizimana Eric", studentClass: "S5A",
    phone: "+250 788 456 789", preview: "Eric was sick yesterday - sent doctor note via WhatsApp",
    unread: false, timestamp: "Yesterday",
    thread: [
      { from: "parent", text: "Eric was sick yesterday - sent doctor note via WhatsApp", time: "Yesterday 09:00" },
      { from: "teacher", text: "Murakoze cyane. Marked as excused. Get well soon.", time: "Yesterday 09:30" },
    ],
  },
];

export const SMS_TEMPLATES = [
  { id: "t1", label: "Absence Notice", text: "Mwaramutse. Please note [Student] was absent from class today. Murakoze." },
  { id: "t2", label: "Improvement Praise", text: "[Student] has shown great improvement in [Subject] this week. Keep encouraging at home!" },
  { id: "t3", label: "Meeting Request", text: "Please schedule a meeting regarding [Student]'s academic performance. Reply to confirm." },
  { id: "t4", label: "Exam Reminder", text: "[Student] has an exam on [Date]. Please ensure they prepare and arrive on time." },
];

export interface TeacherNotification {
  id: string;
  type: "attendance" | "academic" | "system" | "message";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export const TEACHER_NOTIFICATIONS: TeacherNotification[] = [
  { id: "N1", type: "attendance", title: "Attendance not submitted", description: "S4B Period 3 attendance is still pending submission.", timestamp: "30 min ago", read: false },
  { id: "N2", type: "academic", title: "Exam results required", description: "Submit results for S5B Mid-Term by May 20, 2026.", timestamp: "2 hours ago", read: false },
  { id: "N3", type: "message", title: "New parent message", description: "Mukamana Solange (Mukamana Diane's parent) sent a message.", timestamp: "1 hour ago", read: false },
  { id: "N4", type: "system", title: "Timetable updated", description: "Your weekly timetable was updated by admin. Please review.", timestamp: "Yesterday", read: true },
  { id: "N5", type: "attendance", title: "Late arrival flagged", description: "5 students in S4A arrived late this week — review trend.", timestamp: "2 days ago", read: true },
];

// ===== STAFF PANEL DATA =====
export interface StaffUser {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string;
  section: string;
  phone: string;
  email: string;
  employeeId: string;
  dateJoined: string;
}

export const STAFF_ME: StaffUser = {
  id: "S001",
  name: "Nkurunziza Patrick",
  initials: "NP",
  role: "Boarding Supervisor",
  department: "Boarding",
  section: "Boys Dorm A & B",
  phone: "+250 788 345 678",
  email: "p.nkurunziza@gspk.rw",
  employeeId: "EMP-2020-031",
  dateJoined: "2020-08-15",
};

export interface GateLogEntry {
  id: string;
  time: string;
  studentId: string;
  studentName: string;
  class: string;
  type: "entry" | "exit";
  method: "scan" | "manual";
  officer: string;
  flag?: "unauthorized" | "duplicate";
  notes?: string;
}

export const TODAY_GATE_LOG: GateLogEntry[] = [
  { id: "G1", time: "06:15", studentId: "STU-1004", studentName: "Habimana Patrick", class: "S5A", type: "entry", method: "scan", officer: "Mukamana S." },
  { id: "G2", time: "06:18", studentId: "STU-1011", studentName: "Mutoni Aline", class: "S3B", type: "entry", method: "scan", officer: "Mukamana S." },
  { id: "G3", time: "06:22", studentId: "STU-1023", studentName: "Niyitegeka Diane", class: "S4A", type: "entry", method: "scan", officer: "Mukamana S." },
  { id: "G4", time: "07:05", studentId: "STU-1035", studentName: "Manzi Claude", class: "S2A", type: "entry", method: "manual", officer: "Mukamana S.", notes: "Card forgotten" },
  { id: "G5", time: "12:40", studentId: "STU-1018", studentName: "Keza Grace", class: "S6A", type: "exit", method: "scan", officer: "Nkurunziza P.", notes: "Medical appointment" },
  { id: "G6", time: "14:35", studentId: "STU-1042", studentName: "Kamana Eric", class: "S5A", type: "exit", method: "manual", officer: "Mukamana S.", flag: "unauthorized" },
  { id: "G7", time: "15:10", studentId: "STU-1018", studentName: "Keza Grace", class: "S6A", type: "entry", method: "scan", officer: "Nkurunziza P." },
];

export interface PendingExit {
  studentId: string;
  studentName: string;
  class: string;
  exitTime: string;
  expectedReturn: string;
  overdue: boolean;
}

export const PENDING_EXITS: PendingExit[] = [
  { studentId: "STU-1042", studentName: "Kamana Eric", class: "S5A", exitTime: "14:35", expectedReturn: "16:30", overdue: true },
  { studentId: "STU-1027", studentName: "Iradukunda Marie", class: "S4B", exitTime: "13:00", expectedReturn: "17:00", overdue: false },
];

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  dorm: string;
  parentName: string;
  parentPhone: string;
  type: "Weekend Leave" | "Medical Leave" | "Family Emergency" | "Sick Leave";
  startDate: string;
  endDate: string;
  reason: string;
  requestedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  expectedReturn?: string;
  actualReturn?: string;
  decidedBy?: string;
  staffNotes?: string;
}

export const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: "L001", studentId: "STU-1010", studentName: "Uwimana Jean Paul", class: "S4A", dorm: "Boys Dorm A", parentName: "Uwimana Bernard", parentPhone: "+250 788 234 567", type: "Weekend Leave", startDate: "2026-05-16", endDate: "2026-05-17", reason: "Family event - parents' anniversary celebration", requestedAt: "2026-05-15 10:30", status: "Pending" },
  { id: "L002", studentId: "STU-1015", studentName: "Mukamana Diane", class: "S3B", dorm: "Girls Dorm A", parentName: "Mukamana Solange", parentPhone: "+250 722 345 678", type: "Medical Leave", startDate: "2026-05-15", endDate: "2026-05-16", reason: "Doctor appointment at King Faisal Hospital", requestedAt: "2026-05-14 16:00", status: "Pending" },
  { id: "L003", studentId: "STU-1020", studentName: "Habimana Patrick", class: "S5A", dorm: "Boys Dorm B", parentName: "Habimana Eric", parentPhone: "+250 788 567 890", type: "Family Emergency", startDate: "2026-05-15", endDate: "2026-05-18", reason: "Grandfather hospitalized in Huye", requestedAt: "2026-05-14 22:00", status: "Approved", expectedReturn: "2026-05-18 18:00", decidedBy: "Nkurunziza Patrick" },
  { id: "L004", studentId: "STU-1029", studentName: "Bizimana Olivier", class: "S6A", dorm: "Boys Dorm A", parentName: "Bizimana Alexis", parentPhone: "+250 788 678 901", type: "Weekend Leave", startDate: "2026-05-09", endDate: "2026-05-10", reason: "Sister's wedding", requestedAt: "2026-05-07 14:00", status: "Approved", expectedReturn: "2026-05-10 20:00", actualReturn: "2026-05-10 19:45", decidedBy: "Nkurunziza Patrick" },
  { id: "L005", studentId: "STU-1033", studentName: "Iradukunda Aline", class: "S2A", dorm: "Girls Dorm B", parentName: "Iradukunda Sandrine", parentPhone: "+250 722 789 012", type: "Sick Leave", startDate: "2026-05-12", endDate: "2026-05-13", reason: "Insufficient documentation provided", requestedAt: "2026-05-12 09:00", status: "Rejected", decidedBy: "Bizimana Alexis", staffNotes: "Need medical certificate." },
];

export interface AbsenceAlert {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  dorm: string;
  alertType: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  time: string;
  status: "Active" | "Resolved";
  resolvedBy?: string;
  notes?: string;
}

export const ABSENCE_ALERTS_STAFF: AbsenceAlert[] = [
  { id: "A1", studentId: "STU-1042", studentName: "Kamana Eric", class: "S5A", dorm: "Boys Dorm B", alertType: "Unauthorized gate exit, not returned", severity: "HIGH", time: "14:35", status: "Active" },
  { id: "A2", studentId: "STU-1015", studentName: "Mukamana Diane", class: "S3B", dorm: "Girls Dorm A", alertType: "Absent from evening roll call, leave expired", severity: "MEDIUM", time: "21:15", status: "Active" },
  { id: "A3", studentId: "STU-1003", studentName: "Bizimana Jean", class: "S4A", dorm: "Boys Dorm A", alertType: "Parent notified of morning absence", severity: "LOW", time: "08:00", status: "Active" },
  { id: "A4", studentId: "STU-1019", studentName: "Niyitegeka Marie", class: "S2B", dorm: "Girls Dorm B", alertType: "3 consecutive absences", severity: "MEDIUM", time: "Yesterday", status: "Resolved", resolvedBy: "Bizimana Alexis", notes: "Parent confirmed family emergency." },
];

export const ROLL_CALL_DORMS = [
  { id: "D1", name: "Boys Dorm A", capacity: 60, total: 58 },
  { id: "D2", name: "Boys Dorm B", capacity: 60, total: 54 },
  { id: "D3", name: "Girls Dorm A", capacity: 60, total: 57 },
  { id: "D4", name: "Girls Dorm B", capacity: 60, total: 55 },
];

// Roll-call student rows derived from STUDENTS — simulate dorm assignment
export const ROLL_STUDENTS = STUDENTS.slice(0, 40).map((s, i) => ({
  bedNo: String(i + 1).padStart(3, "0"),
  studentId: s.id,
  name: s.name,
  class: s.class,
  dorm: ROLL_CALL_DORMS[i % 4].name,
}));

export interface MyStaffAttendance {
  date: string;
  day: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: "Present" | "Absent" | "Late";
  notes?: string;
}

export const MY_STAFF_ATTENDANCE: MyStaffAttendance[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  if (isWeekend) {
    return { date: d.toISOString().slice(0, 10), day, checkIn: "—", checkOut: "—", hours: "—", status: "Present", notes: "Weekend" };
  }
  const late = i % 7 === 3;
  return {
    date: d.toISOString().slice(0, 10),
    day,
    checkIn: late ? "08:25" : "07:50",
    checkOut: "18:00",
    hours: late ? "9h 35m" : "10h 10m",
    status: late ? "Late" : "Present",
  };
});

/** Routes disabled for current demo role (Boarding Supervisor) */
export const STAFF_ROLE_DISABLED: Record<string, string[]> = {
  "Boarding Supervisor": ["/staff/gate", "/staff/visitors"],
  "Gate Officer": ["/staff/boarding"],
  "Matron": [],
};

export const UNAUTHORIZED_GATE_ALERTS = [
  { id: "UG1", studentName: "Kamana Eric", class: "S5A", time: "14:35", description: "Exit without authorization — not returned", severity: "HIGH" as const },
  { id: "UG2", studentName: "Mutoni Aline", class: "S3B", time: "06:20", description: "Duplicate scan attempt within 2 minutes", severity: "MEDIUM" as const },
  { id: "UG3", studentName: "Manzi Claude", class: "S2A", time: "22:15", description: "After-hours entry attempt", severity: "HIGH" as const },
];

export const STAFF_DASHBOARD_TASKS = [
  { id: "t1", label: "Morning boarding roll call", time: "06:00", done: false },
  { id: "t2", label: "Gate open for day students", time: "06:30", done: true },
  { id: "t3", label: "Evening roll call", time: "21:00", done: false },
  { id: "t4", label: "Lock gate", time: "22:00", done: false },
];

export const STAFF_RECENT_ACTIVITY = [
  { tone: "default" as const, text: "Mutoni Aline checked in via gate", time: "5 min ago" },
  { tone: "default" as const, text: "Visitor Bizimana Jean requested entry", time: "12 min ago" },
  { tone: "default" as const, text: "Leave approved for Ndayishimiye Patrick", time: "1 hr ago" },
  { tone: "destructive" as const, text: "Unauthorized exit alert: Kamana Eric", time: "2 hrs ago" },
];

export const STAFF_NOTIFICATIONS = [
  { id: "SN1", type: "alert", title: "HIGH Alert: Unauthorized exit", description: "Kamana Eric (S5A) has not returned from gate exit at 14:35.", timestamp: "30 min ago", read: false },
  { id: "SN2", type: "leave", title: "New leave request", description: "Uwimana Jean Paul (S4A) requested weekend leave.", timestamp: "2 hours ago", read: false },
  { id: "SN3", type: "rollcall", title: "Roll call due", description: "Evening roll call starts at 21:00 (Boys Dorm A).", timestamp: "Today 18:00", read: true },
  { id: "SN4", type: "system", title: "Visitor arrived", description: "Bizimana Jean has checked in to see Mr. Habimana Eric.", timestamp: "1 hour ago", read: true },
];

// CLASSES re-export for convenience
export { CLASSES };

// Helper: students by class
export function studentsInClass(cls: string) {
  return STUDENTS.filter(s => s.class === cls);
}

// Auth roles
export type UserRole = "school_admin" | "teacher" | "staff" | "super_admin";
export interface MockUser {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  redirectTo: string;
}
export const MOCK_USERS: MockUser[] = [
  { email: "admin@gspk.rw", password: "admin123", role: "school_admin", name: "Mrs. Uwimana Grace", redirectTo: "/dashboard" },
  { email: "teacher@gspk.rw", password: "teacher123", role: "teacher", name: "Mr. Habimana Eric", redirectTo: "/teacher/dashboard" },
  { email: "staff@gspk.rw", password: "staff123", role: "staff", name: "Nkurunziza Patrick", redirectTo: "/staff/dashboard" },
  { email: "superadmin@ecareafrica.rw", password: "super123", role: "super_admin", name: "Karera Thierry", redirectTo: "/super-admin" },
];
