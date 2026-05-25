/** Super Admin panel — platform-wide mock data (Rwanda schools) */

export type SchoolPlan = "Starter" | "Professional" | "Enterprise" | "Trial";
export type SchoolStatus = "active" | "trial" | "suspended" | "expired" | "grace";

export interface PlatformSchool {
  id: string;
  name: string;
  location: string;
  province: string;
  district: string;
  type: string;
  plan: SchoolPlan;
  status: SchoolStatus;
  students: number;
  staff: number;
  mrrRwf: number;
  renewal: string;
  modules: string[];
  smsUsed: number;
  lastActive: string;
  principal?: string;
  phone?: string;
  email?: string;
  address?: string;
  rne?: string;
}

export const MOCK_PLATFORM_SCHOOLS: PlatformSchool[] = [
  { id: "SCH001", name: "GS Kacyiru", location: "Kigali City, Gasabo", province: "Kigali City", district: "Gasabo", type: "Government", plan: "Professional", status: "active", students: 487, staff: 34, mrrRwf: 53000, renewal: "2026-06-01", modules: ["boarding", "biometrics", "gate"], smsUsed: 1840, lastActive: "2 hrs ago", principal: "Niyonzima Jean", phone: "+250 788 100 201", email: "admin@gskacyiru.rw", address: "Kacyiru, Gasabo", rne: "RNE-001-2020" },
  { id: "SCH002", name: "ES Remera", location: "Kigali City, Kicukiro", province: "Kigali City", district: "Kicukiro", type: "Private", plan: "Enterprise", status: "active", students: 892, staff: 67, mrrRwf: 88000, renewal: "2026-06-15", modules: ["boarding", "biometrics", "gate", "exam", "salary"], smsUsed: 4200, lastActive: "1 hr ago", principal: "Uwase Claudine", phone: "+250 722 200 302", email: "info@esremera.rw", rne: "RNE-002-2018" },
  { id: "SCH003", name: "GS Nyamirambo", location: "Kigali City, Nyarugenge", province: "Kigali City", district: "Nyarugenge", type: "Government", plan: "Starter", status: "expired", students: 234, staff: 18, mrrRwf: 0, renewal: "2026-05-01", modules: [], smsUsed: 0, lastActive: "3 days ago" },
  { id: "SCH004", name: "College Saint André", location: "Kigali City, Gasabo", province: "Kigali City", district: "Gasabo", type: "Seminary", plan: "Enterprise", status: "active", students: 654, staff: 52, mrrRwf: 80000, renewal: "2026-12-31", modules: ["boarding", "biometrics", "gate", "exam", "salary", "visitor"], smsUsed: 3100, lastActive: "4 hrs ago" },
  { id: "SCH005", name: "FAWE Girls School", location: "Kigali City, Gasabo", province: "Kigali City", district: "Gasabo", type: "Private", plan: "Professional", status: "trial", students: 389, staff: 29, mrrRwf: 45000, renewal: "2026-05-30", modules: ["boarding", "biometrics"], smsUsed: 890, lastActive: "6 hrs ago" },
  { id: "SCH006", name: "GS Butare", location: "Southern, Huye", province: "Southern", district: "Huye", type: "Government", plan: "Starter", status: "active", students: 312, staff: 22, mrrRwf: 25000, renewal: "2026-06-01", modules: [], smsUsed: 620, lastActive: "1 day ago" },
  { id: "SCH007", name: "ES Musanze", location: "Northern, Musanze", province: "Northern", district: "Musanze", type: "Government", plan: "Professional", status: "active", students: 445, staff: 31, mrrRwf: 45000, renewal: "2026-07-01", modules: ["boarding", "gate"], smsUsed: 1540, lastActive: "5 hrs ago" },
  { id: "SCH008", name: "GS Rwamagana", location: "Eastern, Rwamagana", province: "Eastern", district: "Rwamagana", type: "Government", plan: "Starter", status: "grace", students: 198, staff: 15, mrrRwf: 25000, renewal: "2026-05-10", modules: [], smsUsed: 120, lastActive: "12 hrs ago" },
];

export const MRR_TREND = [
  { month: "Jun 25", mrr: 1240000 }, { month: "Jul 25", mrr: 1380000 },
  { month: "Aug 25", mrr: 1520000 }, { month: "Sep 25", mrr: 1690000 },
  { month: "Oct 25", mrr: 1820000 }, { month: "Nov 25", mrr: 1950000 },
  { month: "Dec 25", mrr: 2080000 }, { month: "Jan 26", mrr: 2150000 },
  { month: "Feb 26", mrr: 2210000 }, { month: "Mar 26", mrr: 2270000 },
  { month: "Apr 26", mrr: 2310000 }, { month: "May 26", mrr: 2340000 },
];

export const SCHOOL_GROWTH = [
  { month: "Jun 25", schools: 1 }, { month: "Jul 25", schools: 2 },
  { month: "Aug 25", schools: 1 }, { month: "Sep 25", schools: 3 },
  { month: "Oct 25", schools: 2 }, { month: "Nov 25", schools: 4 },
  { month: "Dec 25", schools: 2 }, { month: "Jan 26", schools: 3 },
  { month: "Feb 26", schools: 2 }, { month: "Mar 26", schools: 4 },
  { month: "Apr 26", schools: 3 }, { month: "May 26", schools: 3 },
];

export const PLAN_DISTRIBUTION = [
  { name: "Starter", value: 28, fill: "#94a3b8" },
  { name: "Professional", value: 42, fill: "#3b5998" },
  { name: "Enterprise", value: 22, fill: "#f59e0b" },
  { name: "Trial", value: 8, fill: "#22c55e" },
];

export const PLATFORM_ACTIVITY = [
  { text: "New school onboarded: GS Kacyiru", time: "2 hrs ago", tone: "default" as const },
  { text: "Subscription renewed: ES Remera — Professional", time: "3 hrs ago", tone: "default" as const },
  { text: "Failed SMS batch: 14 messages", time: "4 hrs ago", tone: "warning" as const },
  { text: "Subscription expired: GS Nyamirambo", time: "yesterday", tone: "destructive" as const },
];

export const PLATFORM_USERS = [
  { id: "PU1", name: "Karera Thierry", email: "thierry@schoolos.rw", role: "Platform Admin", lastLogin: "2026-05-15 09:12", status: "Active" as const, permissions: "Full" },
  { id: "PU2", name: "Uwase Claudine", email: "claudine@schoolos.rw", role: "Support", lastLogin: "2026-05-15 08:45", status: "Active" as const, permissions: "Support" },
  { id: "PU3", name: "Niyonzima Frank", email: "frank@schoolos.rw", role: "Sales", lastLogin: "2026-05-14 17:30", status: "Active" as const, permissions: "Sales" },
  { id: "PU4", name: "Ingabire Beatrice", email: "beatrice@schoolos.rw", role: "Finance", lastLogin: "2026-05-15 10:00", status: "Active" as const, permissions: "Billing" },
  { id: "PU5", name: "Mugisha Jean", email: "jean@schoolos.rw", role: "Developer", lastLogin: "2026-05-13 14:20", status: "Inactive" as const, permissions: "Dev" },
];

export const SUBSCRIPTION_HEALTH = [
  { month: "Dec", active: 6, trial: 1, grace: 0, expired: 1 },
  { month: "Jan", active: 6, trial: 1, grace: 0, expired: 1 },
  { month: "Feb", active: 7, trial: 1, grace: 0, expired: 0 },
  { month: "Mar", active: 7, trial: 2, grace: 0, expired: 0 },
  { month: "Apr", active: 7, trial: 1, grace: 1, expired: 0 },
  { month: "May", active: 6, trial: 1, grace: 1, expired: 1 },
];

export interface PlatformInvoice {
  id: string;
  schoolId: string;
  schoolName: string;
  period: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "void" | "draft";
  paymentDate?: string;
}

export const PLATFORM_INVOICES: PlatformInvoice[] = [
  { id: "INV-2026-0089", schoolId: "SCH001", schoolName: "GS Kacyiru", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-15", amount: 53000, status: "paid", paymentDate: "2026-05-08" },
  { id: "INV-2026-0088", schoolId: "SCH002", schoolName: "ES Remera", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-15", amount: 88000, status: "paid", paymentDate: "2026-05-10" },
  { id: "INV-2026-0087", schoolId: "SCH005", schoolName: "FAWE Girls School", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-15", amount: 45000, status: "pending" },
  { id: "INV-2026-0086", schoolId: "SCH008", schoolName: "GS Rwamagana", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-10", amount: 25000, status: "overdue" },
  { id: "INV-2026-0085", schoolId: "SCH003", schoolName: "GS Nyamirambo", period: "Apr 2026", issueDate: "2026-04-01", dueDate: "2026-04-15", amount: 25000, status: "overdue" },
  { id: "INV-2026-0084", schoolId: "SCH004", schoolName: "College Saint André", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-20", amount: 80000, status: "paid", paymentDate: "2026-05-12" },
  { id: "INV-2026-0083", schoolId: "SCH007", schoolName: "ES Musanze", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-15", amount: 45000, status: "pending" },
  { id: "INV-2026-0082", schoolId: "SCH006", schoolName: "GS Butare", period: "May 2026", issueDate: "2026-05-01", dueDate: "2026-05-15", amount: 25000, status: "paid", paymentDate: "2026-05-06" },
];

export const REVENUE_BY_PLAN = [
  { month: "Jan", Starter: 125000, Professional: 405000, Enterprise: 240000 },
  { month: "Feb", Starter: 125000, Professional: 450000, Enterprise: 256000 },
  { month: "Mar", Starter: 150000, Professional: 495000, Enterprise: 272000 },
  { month: "Apr", Starter: 150000, Professional: 540000, Enterprise: 288000 },
  { month: "May", Starter: 175000, Professional: 585000, Enterprise: 320000 },
];

export const REVENUE_BY_PROVINCE = [
  { province: "Kigali", revenue: 1420000 },
  { province: "Eastern", revenue: 180000 },
  { province: "Western", revenue: 95000 },
  { province: "Northern", revenue: 270000 },
  { province: "Southern", revenue: 195000 },
];

export const CHURN_ANALYSIS = [
  { month: "Jan", newMrr: 85000, churnedMrr: 25000 },
  { month: "Feb", newMrr: 92000, churnedMrr: 18000 },
  { month: "Mar", newMrr: 110000, churnedMrr: 32000 },
  { month: "Apr", newMrr: 78000, churnedMrr: 15000 },
  { month: "May", newMrr: 125000, churnedMrr: 45000 },
];

export const PAYMENT_METHODS = [
  { name: "Bank Transfer", value: 45 },
  { name: "Mobile Money", value: 38 },
  { name: "Cash", value: 17 },
];

export const SUPPORT_TICKETS = [
  { id: "TKT-1042", school: "GS Kacyiru", subject: "SMS delivery failures", category: "Technical", priority: "High", assigned: "Uwase Claudine", created: "2026-05-14", updated: "2026-05-15", status: "Open" },
  { id: "TKT-1041", school: "ES Remera", subject: "Invoice discrepancy", category: "Billing", priority: "Medium", assigned: "Ingabire Beatrice", created: "2026-05-13", updated: "2026-05-14", status: "In Progress" },
  { id: "TKT-1040", school: "FAWE Girls School", subject: "Request biometrics module", category: "Feature Request", priority: "Low", assigned: "Niyonzima Frank", created: "2026-05-12", updated: "2026-05-12", status: "Open" },
  { id: "TKT-1039", school: "GS Rwamagana", subject: "Cannot login after renewal", category: "Technical", priority: "High", assigned: "Uwase Claudine", created: "2026-05-11", updated: "2026-05-15", status: "In Progress" },
  { id: "TKT-1038", school: "GS Nyamirambo", subject: "Subscription expired — restore access", category: "Billing", priority: "High", assigned: "Ingabire Beatrice", created: "2026-05-10", updated: "2026-05-10", status: "Resolved" },
];

export const ANNOUNCEMENTS = [
  { id: "A1", title: "Term 2 Platform Updates", type: "Update", target: "All Schools", sentDate: "2026-05-10", status: "Sent", readRate: 78 },
  { id: "A2", title: "Scheduled Maintenance — May 18", type: "Maintenance", target: "All Schools", sentDate: "2026-05-08", status: "Sent", readRate: 92 },
  { id: "A3", title: "New Pindo SMS Rates", type: "Warning", target: "Professional Plan", sentDate: "—", status: "Draft", readRate: 0 },
  { id: "A4", title: "Boarding Module v2 Released", type: "New Feature", target: "Enterprise Plan", sentDate: "2026-05-01", status: "Sent", readRate: 65 },
];

export const AUDIT_LOGS = [
  { id: "AL1", timestamp: "2026-05-15 10:22:14", user: "Karera Thierry", role: "Platform Admin", action: "updated", resourceType: "subscription", resourceName: "ES Remera", school: "ES Remera", ip: "196.44.12.8", severity: "info" as const, before: { plan: "Professional" }, after: { plan: "Enterprise" } },
  { id: "AL2", timestamp: "2026-05-15 09:45:02", user: "Uwase Claudine", role: "Support", action: "suspended", resourceType: "school", resourceName: "GS Nyamirambo", school: "GS Nyamirambo", ip: "196.44.12.15", severity: "warning" as const, before: { status: "grace" }, after: { status: "expired" } },
  { id: "AL3", timestamp: "2026-05-14 16:30:00", user: "Ingabire Beatrice", role: "Finance", action: "created", resourceType: "invoice", resourceName: "INV-2026-0089", school: "GS Kacyiru", ip: "196.44.12.22", severity: "info" as const },
  { id: "AL4", timestamp: "2026-05-14 08:12:33", user: "Karera Thierry", role: "Platform Admin", action: "setting_changed", resourceType: "feature_flag", resourceName: "Biometrics", school: "—", ip: "196.44.12.8", severity: "critical" as const, before: { global: false }, after: { global: true } },
  { id: "AL5", timestamp: "2026-05-13 14:05:11", user: "Niyonzima Frank", role: "Sales", action: "created", resourceType: "school", resourceName: "GS Kacyiru", school: "GS Kacyiru", ip: "196.44.12.31", severity: "info" as const },
];

export const SCHOOL_MODULES = [
  { key: "core", label: "Core Attendance", description: "Card/QR attendance — always included", locked: true },
  { key: "boarding", label: "Boarding Management", description: "Dormitories & roll call", addon: 5000 },
  { key: "biometrics", label: "Biometrics", description: "Fingerprint enrollment", addon: 8000 },
  { key: "gate", label: "Gate Management", description: "Entry/exit logs", addon: 3000 },
  { key: "visitor", label: "Visitor Management", description: "Free with Gate module", addon: 0 },
  { key: "exam", label: "Exam System", description: "Results & grading", addon: 5000 },
  { key: "salary", label: "Salary Management", description: "Payroll for staff", addon: 4000 },
  { key: "parent_app", label: "Parent Mobile App", description: "Parent portal access", addon: 0 },
];

export const ONBOARDING_MODULES = [
  { key: "core", label: "Core Attendance", desc: "Included — cannot disable", included: true, price: 0 },
  { key: "boarding", label: "Boarding Module", desc: "Dormitory management", included: false, price: 5000 },
  { key: "biometrics", label: "Biometrics", desc: "Fingerprint check-in", included: false, price: 8000 },
  { key: "gate", label: "Gate Management", desc: "Entry/exit control", included: false, price: 3000 },
  { key: "visitor", label: "Visitor Management", desc: "Free with Gate", included: false, price: 0 },
  { key: "exam", label: "Exam & Results", desc: "Grades & report cards", included: false, price: 5000 },
  { key: "salary", label: "Salary Management", desc: "Staff payroll", included: false, price: 4000 },
];

export const SUPER_ADMIN_USER = { name: "Karera Thierry", role: "Platform Admin" };

export function schoolById(id: string) {
  return MOCK_PLATFORM_SCHOOLS.find(s => s.id === id);
}

export function planBadgeClass(plan: SchoolPlan | string) {
  const key = String(plan).toLowerCase();
  if (key === "starter" || key === "basic") return "bg-slate-100 text-slate-700";
  if (key === "professional" || key === "standard") return "bg-primary/10 text-primary";
  if (key === "enterprise" || key === "premium") return "bg-amber-100 text-amber-800";
  if (key === "trial") return "bg-emerald-100 text-emerald-800";
  return "bg-muted/40 text-muted-foreground";
}

export function statusBadgeClass(status: SchoolStatus | string) {
  const key = String(status).toLowerCase();
  if (key === "active") return "bg-primary/10 text-primary";
  if (key === "trial") return "bg-amber-100 text-amber-800";
  if (key === "suspended" || key === "expired" || key === "cancelled") {
    return "bg-destructive/10 text-destructive";
  }
  if (key === "grace") return "bg-warning/30 text-warning-foreground";
  return "bg-muted/40 text-muted-foreground";
}

export function genTempPassword() {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
