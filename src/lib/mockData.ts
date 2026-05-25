export type Status = "Present" | "Absent" | "Late";

export interface Student {
  id: string;
  cardId: string;
  name: string;
  gender: "Male" | "Female";
  class: string;
  residency: "Boarding" | "Day";
  parentName: string;
  parentPhone: string;
  attendanceRate: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  timeIn: string;
  status: Status;
  date: string;
}

export const CLASSES = [
  "S1A","S1B","S2A","S2B","S3A","S3B","S4A","S4B","S5A","S5B","S6A","S6B",
];

const FIRST_NAMES = [
  "Uwimana","Mugisha","Niyonzima","Habimana","Iradukunda","Nkurunziza",
  "Bizimana","Umubyeyi","Keza","Ishimwe","Mukamana","Tuyishime",
  "Niyitegeka","Rukundo","Mutoni","Cyusa","Gasana","Uwase",
  "Kayitesi","Manzi","Hirwa","Shema","Munezero","Ineza",
];
const SECOND_NAMES = [
  "Marie","Jean","Eric","Aline","Patrick","Diane","Claude","Grace",
  "Emmanuel","Sandrine","Olivier","Chantal","David","Sonia","Alain","Joyce",
];

const TEACHERS = [
  "Mr. Habimana Eric","Ms. Uwase Diane","Mr. Nkurunziza Patrick","Ms. Mukamana Grace",
  "Mr. Manzi Claude","Ms. Iradukunda Aline","Mr. Bizimana Olivier","Ms. Keza Sandrine",
  "Mr. Rukundo Emmanuel","Ms. Mutoni Chantal","Mr. Gasana David","Ms. Ineza Joyce",
];
const DISTRICTS = ["Kicukiro","Gasabo","Nyarugenge","Musanze","Huye","Rubavu","Rwamagana","Muhanga"];

function rwPhone(seed: number) {
  const a = 780 + (seed % 10);
  const b = String(100 + ((seed * 31) % 900)).padStart(3, "0");
  const c = String(100 + ((seed * 17) % 900)).padStart(3, "0");
  return `+250 ${a} ${b} ${c}`;
}

export const STUDENTS: Student[] = Array.from({ length: 60 }, (_, i) => {
  const cls = CLASSES[Math.floor(i / 5) % CLASSES.length];
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const second = SECOND_NAMES[(i * 3) % SECOND_NAMES.length];
  const name = `${first} ${second}`;
  const parent = `${FIRST_NAMES[(i * 7) % FIRST_NAMES.length]} ${SECOND_NAMES[(i * 5) % SECOND_NAMES.length]}`;
  return {
    id: `STU-${String(1000 + i)}`,
    cardId: `RW${String(20240000 + i)}`,
    name,
    gender: i % 2 === 0 ? "Female" : "Male",
    class: cls,
    residency: i % 4 === 0 ? "Boarding" : "Day",
    parentName: parent,
    parentPhone: rwPhone(i + 1),
    attendanceRate: 70 + ((i * 13) % 30),
  };
});

const STATUS_POOL: Status[] = ["Present","Present","Present","Present","Late","Absent"];
function pickStatus(seed: number): Status {
  return STATUS_POOL[seed % STATUS_POOL.length];
}
function timeIn(seed: number, status: Status) {
  if (status === "Absent") return "—";
  const baseMin = status === "Late" ? 60 + (seed % 25) : 25 + (seed % 35);
  const h = 7 + Math.floor(baseMin / 60);
  const m = baseMin % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

const today = new Date().toISOString().slice(0, 10);

export const TODAY_ATTENDANCE: AttendanceRecord[] = STUDENTS.map((s, i) => {
  const status = pickStatus(i + 2);
  return {
    id: `ATT-${i}`,
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    timeIn: timeIn(i, status),
    status,
    date: today,
  };
});

export function todayCounts() {
  const present = TODAY_ATTENDANCE.filter(a => a.status === "Present").length;
  const absent = TODAY_ATTENDANCE.filter(a => a.status === "Absent").length;
  const late = TODAY_ATTENDANCE.filter(a => a.status === "Late").length;
  return { total: STUDENTS.length, present, absent, late };
}

export const WEEK_ATTENDANCE = [
  { day: "Mon", Present: 215, Absent: 22, Late: 8 },
  { day: "Tue", Present: 220, Absent: 18, Late: 7 },
  { day: "Wed", Present: 198, Absent: 35, Late: 12 },
  { day: "Thu", Present: 225, Absent: 15, Late: 5 },
  { day: "Fri", Present: 210, Absent: 25, Late: 10 },
];

export const CLASS_PIE = CLASSES.map((c, i) => ({
  name: c,
  value: 18 + ((i * 7) % 20),
}));

export const RECENT_CHECKINS = TODAY_ATTENDANCE
  .filter(a => a.status !== "Absent")
  .slice(0, 10)
  .map(a => ({
    name: a.studentName,
    class: a.class,
    time: a.timeIn,
    status: a.status,
  }));

export const ABSENCE_ALERTS = STUDENTS.slice(0, 5).map((s, i) => ({
  id: s.id,
  name: s.name,
  class: s.class,
  daysMissed: 3 + (i % 4),
}));

// ============================================================
// Phase 2 additions
// ============================================================

export interface ClassInfo {
  id: string;
  name: string;
  fullName?: string;
  level: string;
  section: string;
  teacher: string;
  teacherId?: string | null;
  room: string;
  capacity: number;
  studentCount: number;
  classId?: string;
  sectionId?: string;
  academicYearId?: string | null;
}

export const CLASS_LIST: ClassInfo[] = CLASSES.map((c, i) => {
  const levelNum = c[1];
  const section = c.slice(2);
  const nameMatch = c.match(/^([A-Za-z]+\d+)([A-Za-z]+)$/);
  const fullName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : c;
  const studentCount = STUDENTS.filter(s => s.class === c).length;
  return {
    id: `CLS-${i + 1}`,
    name: c,
    fullName,
    level: `Senior ${levelNum}`,
    section,
    teacher: TEACHERS[i % TEACHERS.length],
    room: `Room ${100 + i * 3}`,
    capacity: 40,
    studentCount,
  };
});

export function levelColor(level: string) {
  if (level.includes("1")) return "indigo";
  if (level.includes("2")) return "blue";
  if (level.includes("3")) return "teal";
  if (level.includes("4")) return "green";
  if (level.includes("5")) return "amber";
  return "rose";
}

export function levelBorderClass(level: string) {
  return ({
    indigo: "border-l-indigo-500",
    blue: "border-l-blue-500",
    teal: "border-l-teal-500",
    green: "border-l-green-500",
    amber: "border-l-amber-500",
    rose: "border-l-rose-500",
  } as const)[levelColor(level)];
}

export function levelBadgeClass(level: string) {
  return ({
    indigo: "bg-indigo-100 text-indigo-800",
    blue: "bg-blue-100 text-blue-700",
    teal: "bg-teal-100 text-teal-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  } as const)[levelColor(level)];
}

// Parents: aggregate by parent name (each parent may have one+ students)
export interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string;
  studentIds: string[];
  district: string;
  lastSMSSent: string;
  totalSMSCount: number;
}

const parentMap = new Map<string, Parent>();
STUDENTS.forEach((s, i) => {
  const key = s.parentName;
  if (!parentMap.has(key)) {
    parentMap.set(key, {
      id: `PAR-${1000 + parentMap.size}`,
      name: s.parentName,
      phone: s.parentPhone,
      email: `${s.parentName.toLowerCase().replace(/\s+/g, ".")}@example.rw`,
      studentIds: [],
      district: DISTRICTS[i % DISTRICTS.length],
      lastSMSSent: ["Today 07:32","Today 08:15","Yesterday","2 days ago","Today 07:48","1 week ago"][i % 6],
      totalSMSCount: 5 + (i * 3) % 40,
    });
  }
  parentMap.get(key)!.studentIds.push(s.id);
});
export const PARENTS: Parent[] = Array.from(parentMap.values());
export const DISTRICT_LIST = DISTRICTS;

// SMS Logs
export interface SMSLog {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  class: string;
  parentName: string;
  phone: string;
  message: string;
  status: "sent" | "failed" | "pending";
  trigger: "present" | "absent" | "late";
}

const STATUS_SMS: SMSLog["status"][] = ["sent","sent","sent","sent","sent","sent","sent","sent","failed","pending"];
const TRIGGER_BY_STATUS: Record<Status, SMSLog["trigger"]> = {
  Present: "present", Absent: "absent", Late: "late",
};

function buildMessage(parent: string, student: string, cls: string, trig: SMSLog["trigger"], time: string) {
  const status = trig === "present" ? "yaje" : trig === "late" ? "yatinze" : "ntiyaje";
  return `Mubyeyi ${parent}, umwana wanyu ${student} wo mu ${cls} ${status} ku ishuri uyu munsi saa ${time}. Murakoze. — SmartAttend`;
}

export const SMS_LOGS: SMSLog[] = TODAY_ATTENDANCE.flatMap((a, i) => {
  const stu = STUDENTS.find(s => s.id === a.studentId)!;
  const trig = TRIGGER_BY_STATUS[a.status];
  const time = a.timeIn === "—" ? "08:00" : a.timeIn;
  const ts = `2026-05-12 ${time}`;
  return [{
    id: `SMS-${i}`,
    timestamp: ts,
    studentId: stu.id,
    studentName: stu.name,
    class: stu.class,
    parentName: stu.parentName,
    phone: stu.parentPhone,
    message: buildMessage(stu.parentName, stu.name, stu.class, trig, time),
    status: STATUS_SMS[i % STATUS_SMS.length],
    trigger: trig,
  }];
});

// Biometric profiles
export interface BiometricProfile {
  studentId: string;
  hasFace: boolean;
  hasFingerprint: boolean;
  enrolledAt: string;
}

export const BIOMETRIC_PROFILES: BiometricProfile[] = STUDENTS.map((s, i) => ({
  studentId: s.id,
  hasFace: i % 5 !== 0,           // ~48 of 60
  hasFingerprint: i % 7 !== 0 && i % 3 !== 0, // ~ partial
  enrolledAt: `2025-${String(1 + (i % 9)).padStart(2,"0")}-${String(1 + (i % 27)).padStart(2,"0")}`,
}));

export function biometricStats() {
  const face = BIOMETRIC_PROFILES.filter(b => b.hasFace).length;
  const finger = BIOMETRIC_PROFILES.filter(b => b.hasFingerprint).length;
  return { face, finger, total: BIOMETRIC_PROFILES.length };
}

// SMS templates (English / Kinyarwanda)
export const SMS_TEMPLATES = {
  en: {
    Present: "Dear {parentName}, your child {studentName} of {class} arrived at school today {date} at {time}. Thank you. — SmartAttend",
    Absent: "Dear {parentName}, your child {studentName} of {class} was marked ABSENT today {date}. Please contact the school. — SmartAttend",
    Late: "Dear {parentName}, your child {studentName} of {class} arrived LATE today {date} at {time}. — SmartAttend",
  },
  rw: {
    Present: "Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} yageze ku ishuri uyu munsi {date} saa {time}. Murakoze. — SmartAttend",
    Absent: "Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} ntiyaje ku ishuri uyu munsi {date}. Muhamagare ishuri. — SmartAttend",
    Late: "Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} yatinze uyu munsi {date} saa {time}. — SmartAttend",
  },
};

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Reports: 30-day daily attendance
export const DAILY_TREND = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (29 - i));
  const present = 75 + ((i * 7) % 20);
  const late = 5 + ((i * 3) % 8);
  const absent = Math.max(0, 100 - present - late);
  return {
    date: d.toISOString().slice(5, 10),
    Present: present,
    Late: late,
    Absent: absent,
  };
});

export const WEEKLY_COMPARE = [
  { week: "Week 1", Present: 1080, Late: 45, Absent: 95 },
  { week: "Week 2", Present: 1120, Late: 38, Absent: 70 },
  { week: "Week 3", Present: 1050, Late: 60, Absent: 110 },
  { week: "Week 4", Present: 1140, Late: 42, Absent: 65 },
];

export const CHECKIN_DISTRIBUTION = [
  { slot: "7:00–7:15", count: 38 },
  { slot: "7:15–7:30", count: 92 },
  { slot: "7:30–7:45", count: 145 },
  { slot: "7:45–8:00", count: 78 },
  { slot: "8:00+ Late", count: 32 },
];

// Day-of-week heatmap (4 weeks x 5 weekdays)
export const HEATMAP = ["Mon","Tue","Wed","Thu","Fri"].map((day, di) => ({
  day,
  cells: Array.from({ length: 4 }, (_, wi) => {
    const rate = 70 + ((di * 9 + wi * 13) % 28);
    return { week: wi + 1, rate };
  }),
}));

// ============================================================
// Phase 3 additions — SaaS config, Boarding, Gate, Leaves, Fees, Staff
// ============================================================

export interface SchoolConfig {
  schoolName: string;
  logo: string | null;
  primaryColor: string;
  academicStructure: "rwanda_secondary" | "primary" | "tvet";
  hasBoarding: boolean;
  hasBiometrics: boolean;
  hasGateManagement: boolean;
  enabledModules: string[];
  smsProvider: "pindo" | "africastalking" | "twilio" | "mtn";
  planTier: "basic" | "standard" | "premium" | "enterprise";
  currency: string;
  timezone: string;
  termDates: { term1: { start: string; end: string }; term2: { start: string; end: string }; term3: { start: string; end: string } };
  roles: string[];
  notifications: {
    sendOnPresent: boolean;
    sendOnAbsent: boolean;
    sendOnLate: boolean;
    sendFeeReminders: boolean;
    sendBoardingAlerts: boolean;
    language: "english" | "kinyarwanda" | "both";
  };
}

export const schoolConfig: SchoolConfig = {
  schoolName: "Lycée de Kigali",
  logo: null,
  primaryColor: "#3b5998",
  academicStructure: "rwanda_secondary",
  hasBoarding: true,
  hasBiometrics: true,
  hasGateManagement: true,
  enabledModules: ["dashboard","attendance","students","classes","visitors","fees","staff","boarding","gate","leaves","parents","notifications","reports","settings"],
  smsProvider: "pindo",
  planTier: "premium",
  currency: "RWF",
  timezone: "Africa/Kigali",
  termDates: {
    term1: { start: "2026-01-12", end: "2026-04-10" },
    term2: { start: "2026-05-04", end: "2026-07-31" },
    term3: { start: "2026-09-07", end: "2026-12-04" },
  },
  roles: ["super_admin","school_admin","teacher","warden","accountant","staff"],
  notifications: {
    sendOnPresent: true,
    sendOnAbsent: true,
    sendOnLate: true,
    sendFeeReminders: true,
    sendBoardingAlerts: true,
    language: "english",
  },
};

export function formatRWF(n: number): string {
  return `RWF ${n.toLocaleString("en-US")}`;
}

// ---------- Dormitories ----------
export interface Dormitory {
  id: string;
  name: string;
  gender: "Male" | "Female";
  capacity: number;
  warden: string;
  studentIds: string[];
}

const DORM_NAMES = [
  { name: "House A — Inkotanyi", gender: "Male" as const, warden: "Mr. Munyaneza Eric" },
  { name: "House B — Intwari", gender: "Male" as const, warden: "Mr. Habyarimana Patrick" },
  { name: "Girls Dorm 1 — Imena", gender: "Female" as const, warden: "Ms. Uwineza Diane" },
  { name: "Girls Dorm 2 — Urumuri", gender: "Female" as const, warden: "Ms. Mukashema Grace" },
];

const BOARDERS = STUDENTS.slice(0, 40); // 40 of 60 are boarders

export const DORMITORIES: Dormitory[] = DORM_NAMES.map((d, i) => {
  const eligible = BOARDERS.filter(s => s.gender === d.gender);
  const slice = eligible.slice(Math.floor((i / 2) * eligible.length / 2), Math.floor((i / 2 + 1) * eligible.length / 2));
  return {
    id: `DORM-${i + 1}`,
    name: d.name,
    gender: d.gender,
    capacity: 50,
    warden: d.warden,
    studentIds: slice.map(s => s.id),
  };
});

export function getStudentDorm(studentId: string): Dormitory | undefined {
  return DORMITORIES.find(d => d.studentIds.includes(studentId));
}

// ---------- Gate logs ----------
export interface GateEntryLog {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  cardId: string;
  time: string;
  method: "Card" | "Face" | "Fingerprint";
  status: "On Time" | "Late";
  guard: string;
  date: string;
}

export interface GateExitLog {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  time: string;
  exitType: "Day Leave" | "Boarding Leave" | "Staff Escort";
  authorizedBy: string;
  expectedReturn: string;
  status: "Returned" | "Still Out";
  date: string;
}

const GUARDS = ["Munyakazi Jean","Niyokwizera Eric","Bizimana Paul","Hakizimana Felix"];
const METHODS: GateEntryLog["method"][] = ["Card","Card","Face","Fingerprint","Card"];

export const GATE_ENTRY_LOGS: GateEntryLog[] = STUDENTS.slice(0, 50).map((s, i) => {
  const minute = 25 + (i * 4) % 80;
  const h = 7 + Math.floor(minute / 60);
  const m = minute % 60;
  const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  const status: GateEntryLog["status"] = minute >= 60 ? "Late" : "On Time";
  return {
    id: `GE-${i + 1}`,
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    cardId: s.cardId,
    time,
    method: METHODS[i % METHODS.length],
    status,
    guard: GUARDS[i % GUARDS.length],
    date: today,
  };
});

export const GATE_EXIT_LOGS: GateExitLog[] = STUDENTS.slice(0, 30).map((s, i) => {
  const h = 14 + (i % 5);
  const m = (i * 11) % 60;
  const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  const expH = h + 2 + (i % 4);
  const expectedReturn = `${String(expH).padStart(2,"0")}:00`;
  const types: GateExitLog["exitType"][] = ["Day Leave","Boarding Leave","Staff Escort"];
  const status: GateExitLog["status"] = i % 5 === 0 ? "Still Out" : "Returned";
  return {
    id: `GX-${i + 1}`,
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    time,
    exitType: types[i % types.length],
    authorizedBy: TEACHERS[i % TEACHERS.length],
    expectedReturn,
    status,
    date: today,
  };
});

// ---------- Boarding roll calls ----------
export interface RollCallEntry {
  studentId: string;
  morning: "Present" | "Absent" | "On Leave";
  evening: "Present" | "Absent" | "On Leave";
  consecutiveAbsences: number;
}

export const TODAY_ROLLCALL: RollCallEntry[] = BOARDERS.map((s, i) => {
  const r = i % 9;
  const morning: RollCallEntry["morning"] = r === 0 ? "Absent" : r === 1 ? "On Leave" : "Present";
  const evening: RollCallEntry["evening"] = r === 2 ? "Absent" : r === 3 ? "On Leave" : "Present";
  return {
    studentId: s.id,
    morning,
    evening,
    consecutiveAbsences: r === 0 ? 3 + (i % 3) : r === 2 ? 2 : 0,
  };
});

// ---------- Leave requests ----------
export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  house: string;
  type: "Weekend Leave" | "Medical Leave" | "Family Emergency" | "School Trip" | "Day Exeat" | "Holiday Leave";
  departureDate: string;
  returnDate: string;
  reason: string;
  destination: string;
  contactPerson: string;
  parentPhone: string;
  status: "Pending" | "Approved" | "Rejected";
  requestedBy: string;
  authorizedBy?: string;
}

const LEAVE_TYPES: LeaveRequest["type"][] = ["Weekend Leave","Medical Leave","Family Emergency","School Trip","Day Exeat","Holiday Leave"];
const REASONS = [
  "Visit family in Musanze","Medical appointment at King Faisal","Sister's wedding ceremony",
  "Inter-school football tournament","Funeral attendance","Religious gathering",
  "Doctor appointment - dental","Family emergency at home","Cultural event participation",
  "Sick - flu symptoms",
];

export const LEAVE_REQUESTS: LeaveRequest[] = STUDENTS.slice(0, 20).map((s, i) => {
  const dep = new Date(); dep.setDate(dep.getDate() + (i % 5) - 2);
  const ret = new Date(dep); ret.setDate(ret.getDate() + 1 + (i % 3));
  const dorm = getStudentDorm(s.id);
  const statuses: LeaveRequest["status"][] = ["Pending","Pending","Approved","Approved","Approved","Rejected"];
  return {
    id: `LV-${1000 + i}`,
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    house: dorm?.name ?? "Day Scholar",
    type: LEAVE_TYPES[i % LEAVE_TYPES.length],
    departureDate: dep.toISOString().slice(0, 10),
    returnDate: ret.toISOString().slice(0, 10),
    reason: REASONS[i % REASONS.length],
    destination: DISTRICTS[i % DISTRICTS.length],
    contactPerson: s.parentName,
    parentPhone: s.parentPhone,
    status: statuses[i % statuses.length],
    requestedBy: s.parentName,
    authorizedBy: i % 3 === 0 ? "Mr. Habimana Eric (Warden)" : undefined,
  };
});

// ---------- Fee structure ----------
export interface FeeItem {
  name: string;
  amounts: Record<string, number>; // S1-S6
  mandatory: boolean;
}

export const FEE_STRUCTURE: FeeItem[] = [
  { name: "Tuition", mandatory: true, amounts: { S1: 180000, S2: 190000, S3: 200000, S4: 220000, S5: 240000, S6: 260000 } },
  { name: "Boarding", mandatory: false, amounts: { S1: 120000, S2: 120000, S3: 130000, S4: 140000, S5: 150000, S6: 150000 } },
  { name: "Activity Fee", mandatory: true, amounts: { S1: 15000, S2: 15000, S3: 18000, S4: 20000, S5: 20000, S6: 22000 } },
  { name: "Library Fee", mandatory: true, amounts: { S1: 8000, S2: 8000, S3: 10000, S4: 10000, S5: 12000, S6: 12000 } },
];

export function totalFeeForStudent(studentId: string): number {
  const s = STUDENTS.find(x => x.id === studentId);
  if (!s) return 0;
  const lvl = s.class.slice(0, 2);
  const isBoarder = BOARDERS.some(b => b.id === studentId);
  return FEE_STRUCTURE.reduce((sum, f) => {
    if (f.name === "Boarding" && !isBoarder) return sum;
    return sum + (f.amounts[lvl] ?? 0);
  }, 0);
}

// ---------- Student fees state ----------
export interface StudentFee {
  studentId: string;
  total: number;
  paid: number;
  balance: number;
  lastPayment: string;
  status: "Paid" | "Partial" | "Unpaid" | "Overdue";
}

export const STUDENT_FEES: StudentFee[] = STUDENTS.map((s, i) => {
  const total = totalFeeForStudent(s.id);
  const r = i % 7;
  const paid = r === 0 ? total : r === 1 ? Math.floor(total * 0.6) : r === 2 ? Math.floor(total * 0.3) : r === 3 ? 0 : Math.floor(total * 0.85);
  const balance = total - paid;
  const status: StudentFee["status"] = balance === 0 ? "Paid" : paid === 0 ? (i % 3 === 0 ? "Overdue" : "Unpaid") : "Partial";
  const dt = new Date(); dt.setDate(dt.getDate() - (i * 3) % 60);
  return {
    studentId: s.id,
    total,
    paid,
    balance,
    lastPayment: paid > 0 ? dt.toISOString().slice(0, 10) : "—",
    status,
  };
});

// ---------- Transactions ----------
export interface FeeTransaction {
  id: string;
  receiptNo: string;
  date: string;
  studentId: string;
  studentName: string;
  class: string;
  amount: number;
  method: "Cash" | "MTN MoMo" | "Airtel Money" | "Bank Transfer" | "Cheque";
  reference: string;
  collectedBy: string;
  status: "Completed" | "Pending" | "Refunded";
}

const PAY_METHODS: FeeTransaction["method"][] = ["Cash","MTN MoMo","Airtel Money","Bank Transfer","Cheque"];

export const TRANSACTIONS: FeeTransaction[] = STUDENT_FEES.filter(f => f.paid > 0).slice(0, 40).map((f, i) => {
  const s = STUDENTS.find(x => x.id === f.studentId)!;
  const dt = new Date(); dt.setDate(dt.getDate() - (i * 2) % 90);
  return {
    id: `TXN-${1000 + i}`,
    receiptNo: `RCP-2026-${String(480 + i).padStart(4,"0")}`,
    date: dt.toISOString().slice(0, 10),
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    amount: Math.min(f.paid, 50000 + (i * 1500) % 100000),
    method: PAY_METHODS[i % PAY_METHODS.length],
    reference: `MoMo${100000 + i * 173}`,
    collectedBy: "Mukamana Grace (Accountant)",
    status: "Completed",
  };
});

// ---------- Staff ----------
export interface Staff {
  id: string;
  name: string;
  gender: "Male" | "Female";
  role: "Teacher" | "Admin" | "Warden" | "Accountant" | "Librarian" | "Guard" | "Cleaner" | "Driver" | "Cook";
  department: string;
  subjects?: string[];
  phone: string;
  email: string;
  joinDate: string;
  contractType: "Permanent" | "Contract" | "Part-time";
  status: "Active" | "On Leave" | "Inactive";
}

const STAFF_ROLES: Staff["role"][] = ["Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Teacher","Admin","Warden","Warden","Accountant","Librarian","Guard","Guard","Cleaner","Driver","Cook"];
const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","English","Kinyarwanda","French","History","Geography","Entrepreneurship","ICT"];
const DEPTS = { Teacher: "Teaching", Admin: "Administration", Warden: "Boarding", Accountant: "Finance", Librarian: "Support", Guard: "Support", Cleaner: "Support", Driver: "Support", Cook: "Support" };

export const STAFF: Staff[] = STAFF_ROLES.map((role, i) => {
  const first = FIRST_NAMES[(i * 5) % FIRST_NAMES.length];
  const second = SECOND_NAMES[(i * 7) % SECOND_NAMES.length];
  const name = `${first} ${second}`;
  return {
    id: `STF-2025-${String(i + 1).padStart(3, "0")}`,
    name,
    gender: i % 2 === 0 ? "Male" : "Female",
    role,
    department: DEPTS[role],
    subjects: role === "Teacher" ? [SUBJECTS[i % SUBJECTS.length], SUBJECTS[(i + 3) % SUBJECTS.length]] : undefined,
    phone: rwPhone(i + 100),
    email: `${first.toLowerCase()}.${second.toLowerCase()}@lyceekigali.rw`,
    joinDate: `202${1 + (i % 4)}-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2,"0")}`,
    contractType: i % 4 === 0 ? "Contract" : i % 7 === 0 ? "Part-time" : "Permanent",
    status: i % 11 === 0 ? "On Leave" : "Active",
  };
});

export interface StaffAttendance {
  staffId: string;
  date: string;
  checkIn: string;
  status: "Present" | "Absent" | "Late" | "On Leave";
}

export const STAFF_ATTENDANCE: StaffAttendance[] = STAFF.map((s, i) => ({
  staffId: s.id,
  date: today,
  checkIn: i % 8 === 0 ? "08:15" : i % 11 === 0 ? "—" : `07:${String(20 + (i * 3) % 35).padStart(2,"0")}`,
  status: i % 11 === 0 ? "Absent" : i % 8 === 0 ? "Late" : i % 13 === 0 ? "On Leave" : "Present",
}));

// ---------- Permissions / Roles ----------
export const PERMISSION_GROUPS = [
  { key: "attendance", label: "Attendance", actions: ["view","mark","edit","export"] },
  { key: "students", label: "Students", actions: ["view","register","edit","delete"] },
  { key: "fees", label: "Fee Management", actions: ["view","collect","refund","export"] },
  { key: "reports", label: "Reports", actions: ["view","export"] },
  { key: "sms", label: "SMS", actions: ["send","configure"] },
  { key: "boarding", label: "Boarding", actions: ["view","manage"] },
  { key: "gate", label: "Gate", actions: ["view","manage"] },
  { key: "settings", label: "Settings", actions: ["view","edit"] },
];

export const ROLES_DEF = [
  { name: "Super Admin", description: "Full platform access across all schools", permCount: 32 },
  { name: "School Admin", description: "Full access within one school", permCount: 28 },
  { name: "Teacher", description: "Mark attendance and view assigned classes", permCount: 8 },
  { name: "Staff", description: "General staff with limited access", permCount: 4 },
  { name: "Receptionist", description: "Gate logs and visitor management", permCount: 6 },
  { name: "Warden", description: "Boarding and roll call management", permCount: 10 },
  { name: "Accountant", description: "Fee collection and financial reports", permCount: 12 },
];

// ---------- SMS Providers ----------
export const SMS_PROVIDERS = [
  { id: "pindo", name: "Pindo.io", recommended: true, balance: 12450, monthlyLimit: 50000, senderId: "SmartAttend" },
  { id: "africastalking", name: "Africa's Talking", recommended: false, balance: 8200, monthlyLimit: 30000, senderId: "SCHOOL" },
  { id: "twilio", name: "Twilio", recommended: false, balance: 4800, monthlyLimit: 25000, senderId: "+15555550100" },
  { id: "mtn", name: "MTN SMS", recommended: false, balance: 9100, monthlyLimit: 40000, senderId: "MTNRW" },
];

// ---------- Plans ----------
export const PLANS = [
  { tier: "basic", name: "Basic", price: 50000, students: 200, sms: 2000, features: ["Attendance","Students","Basic Reports"] },
  { tier: "standard", name: "Standard", price: 120000, students: 500, sms: 8000, features: ["Everything in Basic","Parents SMS","Fee Tracking","Classes"] },
  { tier: "premium", name: "Premium", price: 250000, students: 1500, sms: 25000, features: ["Everything in Standard","Boarding","Gate Management","Biometrics","Advanced Reports"] },
  { tier: "enterprise", name: "Enterprise", price: 500000, students: 9999, sms: 100000, features: ["Everything in Premium","Multi-school","Priority Support","Custom Integrations","SLA"] },
];

// ---------- Super Admin: schools across the platform ----------
export interface PlatformSchool {
  id: string;
  name: string;
  district: string;
  province: string;
  studentCount: number;
  staffCount: number;
  plan: "basic" | "standard" | "premium" | "enterprise";
  status: "Active" | "Trial" | "Suspended";
  signupDate: string;
}

export const PLATFORM_SCHOOLS: PlatformSchool[] = [
  { id: "SCH-001", name: "Lycée de Kigali", district: "Nyarugenge", province: "Kigali", studentCount: 1240, staffCount: 78, plan: "premium", status: "Active", signupDate: "2024-01-15" },
  { id: "SCH-002", name: "Groupe Scolaire Notre Dame de Cîteaux", district: "Nyarugenge", province: "Kigali", studentCount: 980, staffCount: 62, plan: "premium", status: "Active", signupDate: "2024-02-08" },
  { id: "SCH-003", name: "Riviera High School", district: "Gasabo", province: "Kigali", studentCount: 760, staffCount: 48, plan: "standard", status: "Active", signupDate: "2024-03-22" },
  { id: "SCH-004", name: "FAWE Girls School", district: "Gasabo", province: "Kigali", studentCount: 540, staffCount: 38, plan: "standard", status: "Active", signupDate: "2024-04-11" },
  { id: "SCH-005", name: "Green Hills Academy", district: "Kicukiro", province: "Kigali", studentCount: 1450, staffCount: 95, plan: "enterprise", status: "Active", signupDate: "2024-01-30" },
  { id: "SCH-006", name: "Ecole Secondaire Musanze", district: "Musanze", province: "Northern", studentCount: 420, staffCount: 28, plan: "basic", status: "Trial", signupDate: "2026-04-18" },
  { id: "SCH-007", name: "Groupe Scolaire Huye", district: "Huye", province: "Southern", studentCount: 680, staffCount: 42, plan: "standard", status: "Active", signupDate: "2024-09-05" },
  { id: "SCH-008", name: "Rubavu Secondary School", district: "Rubavu", province: "Western", studentCount: 510, staffCount: 32, plan: "basic", status: "Suspended", signupDate: "2024-11-12" },
  { id: "SCH-009", name: "Rwamagana High School", district: "Rwamagana", province: "Eastern", studentCount: 720, staffCount: 45, plan: "standard", status: "Active", signupDate: "2025-01-20" },
  { id: "SCH-010", name: "Petit Séminaire de Rwesero", district: "Muhanga", province: "Southern", studentCount: 380, staffCount: 26, plan: "basic", status: "Active", signupDate: "2025-02-14" },
];

export const SCHOOL_SIGNUPS_TREND = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - (11 - i));
  return { month: d.toLocaleString("en-US", { month: "short" }), schools: 1 + ((i * 3 + 2) % 5) };
});

// ---------- SMS templates extended ----------
export interface SMSTemplate {
  key: string;
  label: string;
  trigger: string;
  en: string;
  rw: string;
}

export const SMS_TEMPLATE_LIST: SMSTemplate[] = [
  { key: "attendance_present", label: "Attendance Present", trigger: "🎓 Attendance",
    en: "Dear {parentName}, {studentName} of {class} arrived at school on {date} at {time}. Thank you. — SmartAttend",
    rw: "Mubyeyi {parentName}, {studentName} wo mu {class} yageze ku ishuri {date} saa {time}. Murakoze. — SmartAttend" },
  { key: "attendance_absent", label: "Attendance Absent", trigger: "🎓 Attendance",
    en: "Dear {parentName}, your child {studentName} of {class} was ABSENT today {date}. Please contact the school. — SmartAttend",
    rw: "Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} ntiyaje ku ishuri {date}. Muhamagare ishuri. — SmartAttend" },
  { key: "attendance_late", label: "Attendance Late", trigger: "🎓 Attendance",
    en: "Dear {parentName}, {studentName} of {class} arrived LATE today {date} at {time}. — SmartAttend",
    rw: "Mubyeyi {parentName}, {studentName} wo mu {class} yatinze {date} saa {time}. — SmartAttend" },
  { key: "fee_reminder", label: "Fee Reminder", trigger: "💰 Fee",
    en: "Dear {parentName}, school fees balance for {studentName} is RWF {amount}. Please pay by {date} to avoid penalties. — {schoolName}",
    rw: "Mubyeyi {parentName}, ibisigaye by'amafaranga ya {studentName} ni RWF {amount}. Mwitabe mbere ya {date}. — {schoolName}" },
  { key: "boarding_absent", label: "Boarding Absent", trigger: "🏠 Boarding",
    en: "Dear {parentName}, {studentName} was MISSING from boarding roll call on {date}. Please contact the warden. — SmartAttend",
    rw: "Mubyeyi {parentName}, {studentName} ntiyabonetse mu kubarura uyu munsi {date}. Muvugane n'ushinzwe. — SmartAttend" },
  { key: "leave_approved", label: "Leave Approved", trigger: "📋 Leave",
    en: "Dear {parentName}, your child {studentName} has been granted {type} from {date} to {returnDate}. — SmartAttend",
    rw: "Mubyeyi {parentName}, umwana wanyu {studentName} yahawe uruhushya rwa {type} kuva {date} kugeza {returnDate}. — SmartAttend" },
  { key: "leave_rejected", label: "Leave Rejected", trigger: "📋 Leave",
    en: "Dear {parentName}, the leave request for {studentName} ({type}) has been REJECTED. Reason: {reason}. — SmartAttend",
    rw: "Mubyeyi {parentName}, uruhushya rwa {studentName} ({type}) ntirwemewe. Impamvu: {reason}. — SmartAttend" },
  { key: "return_overdue", label: "Return Overdue", trigger: "📋 Leave",
    en: "Dear {parentName}, {studentName} has not returned to school by the expected time {time}. Please respond urgently. — SmartAttend",
    rw: "Mubyeyi {parentName}, {studentName} ntarasubira ku ishuri ku gihe {time}. Mutwite vuba. — SmartAttend" },
  { key: "welcome", label: "Welcome (new student)", trigger: "🎓 Attendance",
    en: "Welcome {studentName} to {schoolName}! Your card ID is {cardId}. — SmartAttend",
    rw: "Murakaza neza {studentName} ku ishuri {schoolName}! Nimero ya karita ni {cardId}. — SmartAttend" },
  { key: "fee_receipt", label: "Receipt (fee paid)", trigger: "💰 Fee",
    en: "Dear {parentName}, payment of RWF {amount} received for {studentName}. Receipt: {receiptNo}. Balance: RWF {balance}. — {schoolName}",
    rw: "Mubyeyi {parentName}, twakiriye RWF {amount} kuri {studentName}. Inyemeza: {receiptNo}. Ibisigaye: RWF {balance}. — {schoolName}" },
];


// ============= Visitors =============
export interface Visitor {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  organization: string;
  purpose: "Parent Visit" | "Official Business" | "Delivery" | "Inspection" | "Other";
  host: string;
  checkinTime: string;
  checkoutTime?: string;
  status: "on-campus" | "checked-out" | "scheduled";
  date: string;
  notes?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

export const VISITORS: Visitor[] = [
  { id: "V001", name: "Bizimana Jean Pierre", nationalId: "1199080012345678", phone: "+250 788 123 456", organization: "Ministry of Education", purpose: "Inspection", host: "Mrs. Uwimana Grace", checkinTime: "08:30", checkoutTime: "11:45", status: "checked-out", date: "today" },
  { id: "V002", name: "Mukamana Diane", nationalId: "1198570098765432", phone: "+250 722 987 654", organization: "Parent of Keza Aline (S3A)", purpose: "Parent Visit", host: "Mr. Habimana Eric", checkinTime: "10:15", status: "on-campus", date: "today" },
  { id: "V003", name: "Habimana Eric", nationalId: "1199002233445566", phone: "+250 788 445 102", organization: "MTN Rwanda", purpose: "Delivery", host: "Mr. Manzi Claude", checkinTime: "09:05", checkoutTime: "09:35", status: "checked-out", date: "today" },
  { id: "V004", name: "Uwase Sandrine", nationalId: "1198811223344556", phone: "+250 733 776 198", organization: "Parent of Mugisha Patrick (S5B)", purpose: "Parent Visit", host: "Ms. Mukamana Grace", checkinTime: "11:20", status: "on-campus", date: "today" },
  { id: "V005", name: "Niyitegeka Olivier", nationalId: "1199500099887766", phone: "+250 788 909 010", organization: "REB Inspector", purpose: "Inspection", host: "Mrs. Uwimana Grace", checkinTime: "13:00", status: "on-campus", date: "today" },
  { id: "V006", name: "Mutoni Chantal", nationalId: "1198633445566778", phone: "+250 722 332 010", organization: "Bralirwa Ltd", purpose: "Official Business", host: "Mr. Rukundo Emmanuel", checkinTime: "14:10", checkoutTime: "15:00", status: "checked-out", date: "yesterday" },
  { id: "V007", name: "Gasana David", nationalId: "1199711334455667", phone: "+250 788 220 559", organization: "Parent of Ineza Joyce (S2A)", purpose: "Parent Visit", host: "Ms. Iradukunda Aline", checkinTime: "08:00", checkoutTime: "08:45", status: "checked-out", date: "yesterday" },
  { id: "V008", name: "Ishimwe Patrick", nationalId: "1199244556677889", phone: "+250 733 110 902", organization: "Inyange Industries", purpose: "Delivery", host: "Mr. Bizimana Olivier", checkinTime: "10:30", checkoutTime: "10:55", status: "checked-out", date: "yesterday" },
  { id: "V009", name: "Kayitesi Joyce", nationalId: "1198855667788990", phone: "+250 788 661 442", organization: "Auditor", purpose: "Official Business", host: "Mrs. Uwimana Grace", checkinTime: "—", status: "scheduled", date: "tomorrow", appointmentDate: "Tomorrow", appointmentTime: "09:00" },
  { id: "V010", name: "Shema Alain", nationalId: "1199366778899001", phone: "+250 722 558 994", organization: "Parent of Cyusa Marie (S4A)", purpose: "Parent Visit", host: "Mr. Habimana Eric", checkinTime: "—", status: "scheduled", date: "tomorrow", appointmentDate: "Tomorrow", appointmentTime: "14:30" },
];

// ============= Subscription Invoices =============
export interface SubscriptionInvoice {
  id: string;
  period: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  items: { label: string; amount: number }[];
}

export const SUBSCRIPTION_INVOICES: SubscriptionInvoice[] = [
  { id: "INV-2026-005", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-10", amount: 45000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 35000 }, { label: "SMS Bundle (2,000 msgs)", amount: 6000 }, { label: "Biometrics Module", amount: 4000 }] },
  { id: "INV-2026-004", period: "April 2026", issueDate: "2026-04-01", dueDate: "2026-04-10", amount: 45000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 35000 }, { label: "SMS Bundle (2,000 msgs)", amount: 6000 }, { label: "Biometrics Module", amount: 4000 }] },
  { id: "INV-2026-003", period: "March 2026", issueDate: "2026-03-01", dueDate: "2026-03-10", amount: 45000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 35000 }, { label: "SMS Bundle (2,000 msgs)", amount: 6000 }, { label: "Biometrics Module", amount: 4000 }] },
  { id: "INV-2026-002", period: "February 2026", issueDate: "2026-02-01", dueDate: "2026-02-10", amount: 45000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 35000 }, { label: "SMS Bundle (2,000 msgs)", amount: 6000 }, { label: "Biometrics Module", amount: 4000 }] },
  { id: "INV-2026-001", period: "January 2026", issueDate: "2026-01-01", dueDate: "2026-01-10", amount: 45000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 35000 }, { label: "SMS Bundle (2,000 msgs)", amount: 6000 }, { label: "Biometrics Module", amount: 4000 }] },
  { id: "INV-2025-012", period: "December 2025", issueDate: "2025-12-01", dueDate: "2025-12-10", amount: 40000, status: "paid",
    items: [{ label: "Platform Subscription Fee (Professional)", amount: 32000 }, { label: "SMS Bundle (1,500 msgs)", amount: 4500 }, { label: "Biometrics Module", amount: 3500 }] },
];

export interface SubscriptionPlan {
  current: { name: string; tier: string; status: "Active" | "Expired" | "Grace Period"; cycle: "Monthly" | "Annual"; nextBilling: string; amount: number; features: string[] };
  usage: { students: { used: number; limit: number }; sms: { used: number; limit: number }; staff: { used: number; limit: number } };
}

export const subscriptionPlan: SubscriptionPlan = {
  current: {
    name: "Professional Plan",
    tier: "professional",
    status: "Active",
    cycle: "Monthly",
    nextBilling: "June 15, 2026",
    amount: 45000,
    features: ["Up to 500 students", "Biometrics enrollment", "Boarding management", "SMS notifications", "Gate management", "Priority support"],
  },
  usage: {
    students: { used: 312, limit: 500 },
    sms: { used: 1240, limit: 2000 },
    staff: { used: 18, limit: 50 },
  },
};

export interface PlanOption {
  id: "starter" | "professional" | "enterprise";
  name: string;
  monthly: number;
  annual: number;
  studentLimit: string;
  features: { label: string; included: boolean }[];
}

export const PLAN_OPTIONS: PlanOption[] = [
  { id: "starter", name: "Starter", monthly: 25000, annual: 240000, studentLimit: "Up to 200 students",
    features: [
      { label: "Card/QR attendance", included: true },
      { label: "SMS notifications (500/mo)", included: true },
      { label: "Basic reports", included: true },
      { label: "Biometrics", included: false },
      { label: "Boarding & Gate", included: false },
      { label: "Priority support", included: false },
    ] },
  { id: "professional", name: "Professional", monthly: 45000, annual: 432000, studentLimit: "Up to 500 students",
    features: [
      { label: "Card/QR attendance", included: true },
      { label: "SMS notifications (2,000/mo)", included: true },
      { label: "Advanced reports", included: true },
      { label: "Biometrics", included: true },
      { label: "Boarding & Gate", included: true },
      { label: "Priority support", included: true },
    ] },
  { id: "enterprise", name: "Enterprise", monthly: 80000, annual: 768000, studentLimit: "Unlimited students",
    features: [
      { label: "All Professional features", included: true },
      { label: "Unlimited SMS", included: true },
      { label: "Custom integrations", included: true },
      { label: "Dedicated account manager", included: true },
      { label: "On-site training", included: true },
      { label: "99.9% SLA", included: true },
    ] },
];
