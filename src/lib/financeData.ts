// ============================================================================
// Finance Department seed data
// ----------------------------------------------------------------------------
// Single-user "Finance Manager" workspace. All Finance modules read their
// mock/seed data from here. Where student-fee data already existed in
// mockData.ts we re-export it so the Finance Department is the single source
// of truth for financial information in the frontend.
// ============================================================================

import {
  STUDENTS,
  STAFF,
  STUDENT_FEES,
  TRANSACTIONS,
  FEE_STRUCTURE,
  formatRWF,
  schoolConfig,
  type Student,
  type Staff,
  type StudentFee,
  type FeeTransaction,
  type FeeItem,
} from "./mockData";

// School name used on printed invoices / receipts
export const schoolInvoiceName = schoolConfig.schoolName;

// Re-export the finance-relevant slices of mockData so pages import from one place.
export {
  STUDENTS,
  STAFF,
  STUDENT_FEES,
  TRANSACTIONS,
  FEE_STRUCTURE,
  formatRWF,
};
export type { Student, Staff, StudentFee, FeeTransaction, FeeItem };

// ----------------------------------------------------------------------------
// The single Finance Department user (manages ALL functionality)
// ----------------------------------------------------------------------------
export const FINANCE_ME = {
  name: "Mukamana Grace",
  initials: "MG",
  role: "Finance Manager",
  department: "Finance",
  email: "grace.mukamana@lyceekigali.rw",
  // This single account is granted every finance capability.
  capabilities: [
    "Fee Structure", "Invoicing", "Payments", "Payroll",
    "Expenses", "Inventory", "Reporting", "Approvals",
  ],
};

export const ACADEMIC_SESSION = "2025–2026";
export const CURRENT_TERM = "Term 2";

// ----------------------------------------------------------------------------
// 1. Fee Structure Management
// ----------------------------------------------------------------------------
export type FeeFrequency = "One Time" | "Monthly" | "Term" | "Annual";

export interface FeeCategory {
  id: string;
  name: string;
  frequency: FeeFrequency;
  session: string;
  // Amount per class level S1–S6
  amounts: Record<string, number>;
  mandatory: boolean;
  active: boolean;
  effectiveDate: string;
  discountEligible: boolean;
}

const LEVELS = ["S1", "S2", "S3", "S4", "S5", "S6"];
function ladder(base: number, step: number): Record<string, number> {
  return LEVELS.reduce((o, lvl, i) => ({ ...o, [lvl]: base + step * i }), {});
}

export const FEE_CATEGORIES: FeeCategory[] = [
  { id: "FC-01", name: "Admission Fee", frequency: "One Time", session: ACADEMIC_SESSION, amounts: ladder(50000, 0), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-02", name: "Registration Fee", frequency: "Annual", session: ACADEMIC_SESSION, amounts: ladder(30000, 0), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-03", name: "Tuition Fee", frequency: "Term", session: ACADEMIC_SESSION, amounts: ladder(180000, 16000), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: true },
  { id: "FC-04", name: "Examination Fee", frequency: "Term", session: ACADEMIC_SESSION, amounts: ladder(12000, 1000), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-05", name: "Transport Fee", frequency: "Monthly", session: ACADEMIC_SESSION, amounts: ladder(25000, 0), mandatory: false, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-06", name: "Hostel Fee", frequency: "Term", session: ACADEMIC_SESSION, amounts: ladder(120000, 6000), mandatory: false, active: true, effectiveDate: "2025-09-01", discountEligible: true },
  { id: "FC-07", name: "Library Fee", frequency: "Annual", session: ACADEMIC_SESSION, amounts: ladder(8000, 800), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-08", name: "Laboratory Fee", frequency: "Term", session: ACADEMIC_SESSION, amounts: ladder(15000, 1500), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-09", name: "Sports Fee", frequency: "Annual", session: ACADEMIC_SESSION, amounts: ladder(10000, 0), mandatory: false, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-10", name: "Uniform Fee", frequency: "One Time", session: ACADEMIC_SESSION, amounts: ladder(35000, 0), mandatory: false, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-11", name: "Medical Fee", frequency: "Annual", session: ACADEMIC_SESSION, amounts: ladder(18000, 0), mandatory: true, active: true, effectiveDate: "2025-09-01", discountEligible: false },
  { id: "FC-12", name: "Late Fee", frequency: "One Time", session: ACADEMIC_SESSION, amounts: ladder(5000, 0), mandatory: false, active: false, effectiveDate: "2025-09-01", discountEligible: false },
];

// ----------------------------------------------------------------------------
// 2. Invoice Management
// ----------------------------------------------------------------------------
export type InvoiceStatus =
  | "Draft" | "Pending" | "Partially Paid" | "Paid" | "Cancelled" | "Refunded";

export interface StudentInvoice {
  id: string; // unique invoice number
  studentId: string;
  studentName: string;
  class: string;
  session: string;
  term: string;
  issueDate: string;
  dueDate: string;
  items: { label: string; amount: number }[];
  discount: number;
  previousBalance: number;
  lateCharges: number;
  total: number;
  paid: number;
  status: InvoiceStatus;
}

const INV_STATUS_BY_FEE: Record<StudentFee["status"], InvoiceStatus> = {
  Paid: "Paid",
  Partial: "Partially Paid",
  Unpaid: "Pending",
  Overdue: "Pending",
};

export const STUDENT_INVOICES: StudentInvoice[] = STUDENT_FEES.slice(0, 40).map((f, i) => {
  const s = STUDENTS.find((x) => x.id === f.studentId)!;
  const lvl = s.class.slice(0, 2);
  const items = FEE_STRUCTURE.filter((it) => it.mandatory || i % 3 === 0).map((it) => ({
    label: it.name,
    amount: it.amounts[lvl] ?? 0,
  }));
  const discount = f.status === "Paid" && i % 5 === 0 ? 20000 : 0;
  const lateCharges = f.status === "Overdue" ? 5000 : 0;
  const previousBalance = i % 6 === 0 ? 15000 : 0;
  const issue = new Date(); issue.setDate(issue.getDate() - ((i * 4) % 70));
  const due = new Date(issue); due.setDate(due.getDate() + 30);
  let status = INV_STATUS_BY_FEE[f.status];
  if (i % 17 === 0) status = "Draft";
  if (i % 19 === 0) status = "Cancelled";
  return {
    id: `INV-2026-${String(1000 + i)}`,
    studentId: s.id,
    studentName: s.name,
    class: s.class,
    session: ACADEMIC_SESSION,
    term: CURRENT_TERM,
    issueDate: issue.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    items,
    discount,
    previousBalance,
    lateCharges,
    total: f.total - discount + lateCharges + previousBalance,
    paid: f.paid,
    status,
  };
});

// ----------------------------------------------------------------------------
// 3. Payment Methods (supported list)
// ----------------------------------------------------------------------------
export const PAYMENT_METHODS = [
  "Cash", "Bank Transfer", "Mobile Money", "Credit/Debit Card", "Online Gateway", "Cheque",
] as const;

// ----------------------------------------------------------------------------
// 4. Salary Management / Payroll
// ----------------------------------------------------------------------------
export type PayrollStatus = "Draft" | "Submitted" | "Approved" | "Paid";

export interface Payslip {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  department: string;
  month: string;
  basic: number;
  allowances: number;
  overtime: number;
  bonus: number;
  tax: number;
  pension: number;
  loanRecovery: number;
  gross: number;
  deductions: number;
  net: number;
  status: PayrollStatus;
}

const ROLE_BASE: Record<string, number> = {
  Teacher: 350000, Admin: 420000, Warden: 300000, Accountant: 400000,
  Librarian: 250000, Guard: 180000, Cleaner: 150000, Driver: 220000, Cook: 170000,
};

export const PAYROLL_MONTH = "June 2026";

export const PAYSLIPS: Payslip[] = STAFF.map((emp, i) => {
  const basic = ROLE_BASE[emp.role] ?? 250000;
  const allowances = Math.round(basic * 0.18);
  const overtime = i % 4 === 0 ? 25000 : 0;
  const bonus = i % 6 === 0 ? 40000 : 0;
  const gross = basic + allowances + overtime + bonus;
  const tax = Math.round(gross * 0.15);
  const pension = Math.round(basic * 0.05);
  const loanRecovery = i % 7 === 0 ? 30000 : 0;
  const deductions = tax + pension + loanRecovery;
  const status: PayrollStatus = i % 9 === 0 ? "Draft" : "Submitted";
  return {
    id: `PS-2026-06-${String(i + 1).padStart(3, "0")}`,
    employeeId: emp.id,
    name: emp.name,
    role: emp.role,
    department: emp.department,
    month: PAYROLL_MONTH,
    basic, allowances, overtime, bonus,
    tax, pension, loanRecovery,
    gross, deductions,
    net: gross - deductions,
    status,
  };
});

// Historical payroll runs (approved months)
export interface PayrollRun {
  month: string;
  employees: number;
  gross: number;
  deductions: number;
  net: number;
  status: PayrollStatus;
  approvedBy: string;
}

const CURRENT_GROSS = PAYSLIPS.reduce((s, p) => s + p.gross, 0);
const CURRENT_DED = PAYSLIPS.reduce((s, p) => s + p.deductions, 0);

export const PAYROLL_RUNS: PayrollRun[] = [
  { month: "June 2026", employees: PAYSLIPS.length, gross: CURRENT_GROSS, deductions: CURRENT_DED, net: CURRENT_GROSS - CURRENT_DED, status: "Submitted", approvedBy: "—" },
  { month: "May 2026", employees: PAYSLIPS.length, gross: CURRENT_GROSS, deductions: CURRENT_DED, net: CURRENT_GROSS - CURRENT_DED, status: "Paid", approvedBy: FINANCE_ME.name },
  { month: "April 2026", employees: PAYSLIPS.length - 1, gross: Math.round(CURRENT_GROSS * 0.96), deductions: Math.round(CURRENT_DED * 0.96), net: Math.round((CURRENT_GROSS - CURRENT_DED) * 0.96), status: "Paid", approvedBy: FINANCE_ME.name },
  { month: "March 2026", employees: PAYSLIPS.length - 1, gross: Math.round(CURRENT_GROSS * 0.95), deductions: Math.round(CURRENT_DED * 0.95), net: Math.round((CURRENT_GROSS - CURRENT_DED) * 0.95), status: "Paid", approvedBy: FINANCE_ME.name },
];

// ----------------------------------------------------------------------------
// 5. Expense Tracking
// ----------------------------------------------------------------------------
export type ExpenseStatus = "Pending" | "Approved" | "Paid" | "Rejected";

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  hasDocument: boolean;
  status: ExpenseStatus;
  approvedBy: string;
}

export const EXPENSE_CATEGORIES = [
  "Utilities", "Internet", "Fuel", "Maintenance", "Office Supplies",
  "Cleaning", "Marketing", "Transport", "Repairs", "Miscellaneous",
];

const EXPENSE_VENDORS = [
  "REG Energy", "MTN Business", "SP Petrol Station", "BuildFix Ltd", "Office Mart",
  "CleanCo", "AdReach", "Kigali Movers", "TechRepair Rw", "Sundry Traders",
];

export const EXPENSES: Expense[] = Array.from({ length: 28 }, (_, i) => {
  const dt = new Date(); dt.setDate(dt.getDate() - (i * 3) % 90);
  const amount = 20000 + ((i * 37) % 40) * 7500;
  const statusPool: ExpenseStatus[] = ["Paid", "Paid", "Approved", "Pending", "Rejected"];
  return {
    id: `EXP-2026-${String(200 + i)}`,
    date: dt.toISOString().slice(0, 10),
    category: EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length],
    description: `${EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length]} — ${dt.toLocaleDateString("en-US", { month: "short" })} settlement`,
    vendor: EXPENSE_VENDORS[i % EXPENSE_VENDORS.length],
    amount,
    hasDocument: i % 5 !== 0,
    status: statusPool[i % statusPool.length],
    approvedBy: statusPool[i % statusPool.length] === "Pending" ? "—" : FINANCE_ME.name,
  };
});

// ----------------------------------------------------------------------------
// 6. Inventory & Procurement Finance
// ----------------------------------------------------------------------------
export interface Supplier {
  id: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  balance: number;
}

export const SUPPLIERS: Supplier[] = [
  { id: "SUP-01", name: "Office Mart Ltd", category: "Stationery", contact: "Jean Bosco", phone: "+250 788 123 456", balance: 340000 },
  { id: "SUP-02", name: "SciLab Supplies", category: "Laboratory", contact: "Aline U.", phone: "+250 788 234 567", balance: 0 },
  { id: "SUP-03", name: "FreshFoods Rw", category: "Catering", contact: "Eric M.", phone: "+250 788 345 678", balance: 1250000 },
  { id: "SUP-04", name: "TechHub Kigali", category: "ICT Equipment", contact: "Diane K.", phone: "+250 788 456 789", balance: 0 },
  { id: "SUP-05", name: "BuildFix Ltd", category: "Maintenance", contact: "Patrick N.", phone: "+250 788 567 890", balance: 480000 },
];

export type POStatus = "Requested" | "Ordered" | "Received" | "Invoiced" | "Cancelled";

export interface InventoryItem {
  id: string;
  item: string;
  category: string;
  supplier: string;
  quantity: number;
  unitCost: number;
  reorderLevel: number;
  status: POStatus;
}

export const INVENTORY_ITEMS: InventoryItem[] = [
  { id: "INV-101", item: "A4 Printing Paper (ream)", category: "Stationery", supplier: "Office Mart Ltd", quantity: 45, unitCost: 6500, reorderLevel: 20, status: "Received" },
  { id: "INV-102", item: "Chemistry Reagent Set", category: "Laboratory", supplier: "SciLab Supplies", quantity: 8, unitCost: 85000, reorderLevel: 10, status: "Ordered" },
  { id: "INV-103", item: "Whiteboard Markers (box)", category: "Stationery", supplier: "Office Mart Ltd", quantity: 12, unitCost: 12000, reorderLevel: 15, status: "Received" },
  { id: "INV-104", item: "Desktop Computers", category: "ICT Equipment", supplier: "TechHub Kigali", quantity: 6, unitCost: 550000, reorderLevel: 5, status: "Invoiced" },
  { id: "INV-105", item: "Rice (50kg bag)", category: "Catering", supplier: "FreshFoods Rw", quantity: 30, unitCost: 48000, reorderLevel: 25, status: "Received" },
  { id: "INV-106", item: "Cooking Oil (20L)", category: "Catering", supplier: "FreshFoods Rw", quantity: 9, unitCost: 42000, reorderLevel: 12, status: "Requested" },
  { id: "INV-107", item: "Cleaning Detergent (carton)", category: "Cleaning", supplier: "Office Mart Ltd", quantity: 18, unitCost: 15000, reorderLevel: 10, status: "Received" },
  { id: "INV-108", item: "Cement (bag)", category: "Maintenance", supplier: "BuildFix Ltd", quantity: 4, unitCost: 11500, reorderLevel: 20, status: "Requested" },
];

// ----------------------------------------------------------------------------
// 7. Audit trail (Security & Audit section)
// ----------------------------------------------------------------------------
export interface AuditEntry {
  id: string;
  action: string;
  module: string;
  entity: string;
  performedBy: string;
  role: string;
  timestamp: string;
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: "AUD-1", action: "Approved payroll", module: "Payroll", entity: "May 2026 run", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-21 14:32" },
  { id: "AUD-2", action: "Recorded payment", module: "Payments", entity: "RCP-2026-0501", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-21 11:08" },
  { id: "AUD-3", action: "Created invoice", module: "Invoicing", entity: "INV-2026-1039", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-20 16:45" },
  { id: "AUD-4", action: "Approved expense", module: "Expenses", entity: "EXP-2026-214", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-20 09:20" },
  { id: "AUD-5", action: "Activated fee category", module: "Fee Structure", entity: "Transport Fee", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-19 10:02" },
  { id: "AUD-6", action: "Received goods", module: "Inventory", entity: "INV-105 Rice", performedBy: FINANCE_ME.name, role: "Finance Manager", timestamp: "2026-07-18 13:15" },
];

// ----------------------------------------------------------------------------
// Aggregate helpers for the dashboard & reports
// ----------------------------------------------------------------------------
export function financeSummary() {
  const expected = STUDENT_FEES.reduce((s, f) => s + f.total, 0);
  const collected = STUDENT_FEES.reduce((s, f) => s + f.paid, 0);
  const outstanding = expected - collected;
  const overdue = STUDENT_FEES.filter((f) => f.status === "Overdue").reduce((s, f) => s + f.balance, 0);
  const defaulters = STUDENT_FEES.filter((f) => f.status === "Overdue" || f.status === "Unpaid").length;
  const paidStudents = STUDENT_FEES.filter((f) => f.status === "Paid").length;
  const payrollNet = PAYSLIPS.reduce((s, p) => s + p.net, 0);
  const expensesPaid = EXPENSES.filter((e) => e.status === "Paid").reduce((s, e) => s + e.amount, 0);
  const expensesPending = EXPENSES.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0);
  const inventoryValue = INVENTORY_ITEMS.reduce((s, it) => s + it.quantity * it.unitCost, 0);
  const supplierPayable = SUPPLIERS.reduce((s, sup) => s + sup.balance, 0);
  const netPosition = collected - payrollNet - expensesPaid;
  return {
    expected, collected, outstanding, overdue, defaulters, paidStudents,
    payrollNet, expensesPaid, expensesPending, inventoryValue, supplierPayable, netPosition,
    collectionRate: expected ? Math.round((collected / expected) * 100) : 0,
  };
}

// Collections over the last 30 days (deterministic-ish trend for charts)
export const DAILY_COLLECTIONS = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  amount: 40000 + ((i * 23) % 12) * 18000,
}));

export const MONTHLY_COLLECTIONS = [
  { month: "Jan", collected: 18400000, expected: 22000000 },
  { month: "Feb", collected: 20100000, expected: 22000000 },
  { month: "Mar", collected: 19750000, expected: 22000000 },
  { month: "Apr", collected: 21200000, expected: 23000000 },
  { month: "May", collected: 22600000, expected: 24000000 },
  { month: "Jun", collected: 20900000, expected: 24000000 },
];
