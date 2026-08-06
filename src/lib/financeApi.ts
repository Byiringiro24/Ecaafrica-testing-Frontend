import { apiRequest } from "./api";

// The backend returns money as decimal strings so JSON never loses precision.
// Charts and totals need numbers, so parse at the boundary.
export const toNum = (value: string | number | null | undefined) => Number(value ?? 0);

export const formatRWF = (amount: string | number | null | undefined) =>
  `RWF ${toNum(amount).toLocaleString("en-RW", { maximumFractionDigits: 0 })}`;

type Envelope<T> = { success: boolean; data: T; meta?: Record<string, unknown> };

const get = <T>(path: string) => apiRequest<T>(path, { auth: "school" });

const getWithMeta = <T, M = Record<string, unknown>>(path: string) =>
  apiRequest<Envelope<T> & { meta: M }>(path, { auth: "school", returnMeta: true });

const send = <T>(path: string, method: string, body?: unknown) =>
  apiRequest<T>(path, {
    method,
    auth: "school",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const upload = <T>(path: string, field: string, file: File) => {
  const form = new FormData();
  form.append(field, file);
  return apiRequest<T>(path, { method: "POST", auth: "school", body: form });
};

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export type ListParams = {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  q?: string;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type FinanceSummary = {
  period: { from: string; to: string };
  expected: string;
  collected: string;
  outstanding: string;
  overdue: string;
  collection_rate: number;
  defaulters: number;
  paid_students: number;
  payroll_gross: string;
  payroll_deductions: string;
  payroll_net: string;
  expenses_paid: string;
  expenses_pending: string;
  inventory_value: string;
  low_stock_count: number;
  supplier_payable: string;
  net_position: string;
  collected_in_period: string;
  transactions_in_period: number;
};

export type DailyCollection = { date: string; amount: string };
export type MonthlyCollection = { month: string; collected: string; expected: string };
export type PaymentMethodTotal = { payment_method: string; amount: string; count: number };

type Period = { from_date?: string; to_date?: string };

export const getFinanceSummary = (params: Period = {}) =>
  get<FinanceSummary>(`/finance/dashboard/summary${query(params)}`);

export const getDailyCollections = (params: Period = {}) =>
  get<DailyCollection[]>(`/finance/dashboard/collections/daily${query(params)}`);

export const getMonthlyCollections = (params: Period & { months?: number } = {}) =>
  get<MonthlyCollection[]>(`/finance/dashboard/collections/monthly${query(params)}`);

export const getPaymentMethodTotals = (params: Period = {}) =>
  get<PaymentMethodTotal[]>(`/finance/dashboard/payment-methods${query(params)}`);

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "refunded";

export type InvoiceItem = {
  id: string;
  label: string;
  amount: string;
  fee_structure_id: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  student_number: string;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: string;
  discount: string;
  previous_balance: string;
  late_charges: string;
  total: string;
  amount_paid: string;
  balance: string;
  currency: string;
  status: InvoiceStatus;
  document_url: string | null;
  notes?: string | null;
};

export type InvoiceListMeta = {
  page: number;
  limit: number;
  total: number;
  total_billed: string;
  total_paid: string;
  total_outstanding: string;
};

export const listInvoices = (
  params: ListParams & {
    status?: string;
    student_id?: string;
    term_id?: string;
    academic_year_id?: string;
    from_date?: string;
    to_date?: string;
  } = {}
) => getWithMeta<Invoice[], InvoiceListMeta>(`/finance/invoices${query(params)}`);

export const getInvoice = (id: string) => get<Invoice>(`/finance/invoices/${id}`);

export const createInvoice = (body: {
  student_id: string;
  items: { label: string; amount: number | string; fee_structure_id?: string }[];
  due_date: string;
  issue_date?: string;
  academic_year_id?: string;
  term_id?: string;
  discount?: number | string;
  previous_balance?: number | string;
  late_charges?: number | string;
  status?: "draft" | "pending";
  currency?: string;
  notes?: string;
}) => send<Invoice>("/finance/invoices", "POST", body);

export const issueInvoice = (id: string) =>
  send<Invoice>(`/finance/invoices/${id}/issue`, "PATCH");

export const payInvoice = (id: string, amount: number | string) =>
  send<Invoice>(`/finance/invoices/${id}/payments`, "POST", { amount });

export const cancelInvoice = (id: string, reason?: string) =>
  send<Invoice>(`/finance/invoices/${id}/cancel`, "PATCH", { reason });

export const refundInvoice = (id: string, reason?: string) =>
  send<Invoice>(`/finance/invoices/${id}/refund`, "PATCH", { reason });

export const uploadInvoiceDocument = (id: string, file: File) =>
  upload<Invoice>(`/finance/invoices/${id}/document`, "document", file);

export const deleteInvoice = (id: string) =>
  send<Invoice>(`/finance/invoices/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseStatus = "pending" | "approved" | "paid" | "rejected";

export type Expense = {
  id: string;
  reference: string;
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  vendor: string | null;
  currency: string;
  status: ExpenseStatus;
  document_url: string | null;
  approved_by_name: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  rejection_reason?: string | null;
};

export type ExpenseListMeta = {
  page: number;
  limit: number;
  total: number;
  totals: { pending: string; approved: string; paid: string; rejected: string; all: string };
};

export const listExpenses = (
  params: ListParams & {
    status?: string;
    category?: string;
    vendor?: string;
    from_date?: string;
    to_date?: string;
  } = {}
) => getWithMeta<Expense[], ExpenseListMeta>(`/finance/expenses${query(params)}`);

export const listExpenseCategories = () => get<string[]>("/finance/expenses/categories");

export const createExpense = (body: {
  expense_date: string;
  category: string;
  description: string;
  amount: number | string;
  vendor?: string;
  currency?: string;
  document_url?: string;
}) => send<Expense>("/finance/expenses", "POST", body);

export const updateExpense = (id: string, body: Record<string, unknown>) =>
  send<Expense>(`/finance/expenses/${id}`, "PATCH", body);

export const approveExpense = (id: string) =>
  send<Expense>(`/finance/expenses/${id}/approve`, "PATCH");

export const rejectExpense = (id: string, reason: string) =>
  send<Expense>(`/finance/expenses/${id}/reject`, "PATCH", { reason });

export const markExpensePaid = (
  id: string,
  body: { payment_method?: string; paid_at?: string } = {}
) => send<Expense>(`/finance/expenses/${id}/mark-paid`, "PATCH", body);

export const uploadExpenseDocument = (id: string, file: File) =>
  upload<Expense>(`/finance/expenses/${id}/document`, "document", file);

export const deleteExpense = (id: string) =>
  send<Expense>(`/finance/expenses/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export type Supplier = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: string;
  is_active: boolean;
  inventory_item_count?: number;
};

export const listSuppliers = (
  params: ListParams & { category?: string; is_active?: boolean } = {}
) =>
  getWithMeta<Supplier[], { page: number; limit: number; total: number; total_payable: string }>(
    `/finance/suppliers${query(params)}`
  );

export const createSupplier = (body: {
  name: string;
  category?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance?: number | string;
}) => send<Supplier>("/finance/suppliers", "POST", body);

export const updateSupplier = (id: string, body: Record<string, unknown>) =>
  send<Supplier>(`/finance/suppliers/${id}`, "PATCH", body);

export const deleteSupplier = (id: string) =>
  send<Supplier>(`/finance/suppliers/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type POStatus = "requested" | "ordered" | "received" | "invoiced" | "cancelled";

export type InventoryItem = {
  id: string;
  code: string;
  item_name: string;
  category: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity: number;
  unit_cost: string;
  total_value: string;
  reorder_level: number;
  is_low_stock: boolean;
  status: POStatus;
  notes?: string | null;
  invoice_url?: string | null;
};

export const listInventory = (
  params: ListParams & {
    status?: string;
    category?: string;
    supplier_id?: string;
    low_stock?: boolean;
  } = {}
) =>
  getWithMeta<
    InventoryItem[],
    { page: number; limit: number; total: number; stock_value: string; low_stock_count: number }
  >(`/finance/inventory${query(params)}`);

export const createInventoryItem = (body: {
  item_name: string;
  quantity: number;
  unit_cost: number | string;
  category?: string;
  supplier_id?: string;
  reorder_level?: number;
  status?: POStatus;
  notes?: string;
}) => send<InventoryItem>("/finance/inventory", "POST", body);

export const updateInventoryItem = (id: string, body: Record<string, unknown>) =>
  send<InventoryItem>(`/finance/inventory/${id}`, "PATCH", body);

export const setInventoryStatus = (id: string, status: POStatus) =>
  send<InventoryItem>(`/finance/inventory/${id}/status`, "PATCH", { status });

export const uploadInventoryInvoice = (id: string, file: File) =>
  upload<InventoryItem>(`/finance/inventory/${id}/invoice`, "invoice", file);

export const deleteInventoryItem = (id: string) =>
  send<InventoryItem>(`/finance/inventory/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export type PayrollRunStatus = "draft" | "submitted" | "approved" | "paid";

export type PayrollRun = {
  id: string;
  month: number;
  year: number;
  period: string;
  status: PayrollRunStatus;
  employee_count: number;
  payslip_count: number;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  currency: string;
  approved_by_name: string | null;
  notes?: string | null;
};

export type Payslip = {
  id: string;
  reference: string;
  payroll_run_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  role: string | null;
  department: string | null;
  basic_salary: string;
  allowances: string;
  overtime: string;
  bonus: string;
  gross_salary: string;
  tax: string;
  pension: string;
  loan_recovery: string;
  other_deductions: string;
  total_deductions: string;
  net_salary: string;
  status: PayrollRunStatus;
  payment_method?: string | null;
  paid_at?: string | null;
};

export const listPayrollRuns = (params: ListParams & { status?: string; year?: number } = {}) =>
  getWithMeta<PayrollRun[]>(`/finance/payroll/runs${query(params)}`);

export const getPayrollRun = (id: string) => get<PayrollRun>(`/finance/payroll/runs/${id}`);

export const createPayrollRun = (body: { month: number; year: number; notes?: string }) =>
  send<PayrollRun>("/finance/payroll/runs", "POST", body);

export const submitPayrollRun = (id: string) =>
  send<PayrollRun>(`/finance/payroll/runs/${id}/submit`, "PATCH");

export const approvePayrollRun = (id: string) =>
  send<PayrollRun>(`/finance/payroll/runs/${id}/approve`, "PATCH");

export const markPayrollRunPaid = (id: string, paid_at?: string) =>
  send<PayrollRun>(`/finance/payroll/runs/${id}/mark-paid`, "PATCH", { paid_at });

export const deletePayrollRun = (id: string) =>
  send<PayrollRun>(`/finance/payroll/runs/${id}`, "DELETE");

export type PayslipListMeta = {
  page: number;
  limit: number;
  total: number;
  total_gross: string;
  total_deductions: string;
  total_net: string;
};

export const listPayslips = (
  params: ListParams & {
    payroll_run_id?: string;
    staff_id?: string;
    status?: string;
    department?: string;
  } = {}
) => getWithMeta<Payslip[], PayslipListMeta>(`/finance/payroll/payslips${query(params)}`);

export const getPayslip = (id: string) => get<Payslip>(`/finance/payroll/payslips/${id}`);

export const addPayslip = (
  runId: string,
  body: {
    staff_id: string;
    basic_salary: number | string;
    allowances?: number | string;
    overtime?: number | string;
    bonus?: number | string;
    loan_recovery?: number | string;
    other_deductions?: number | string;
    notes?: string;
  }
) => send<Payslip>(`/finance/payroll/runs/${runId}/payslips`, "POST", body);

export const updatePayslip = (id: string, body: Record<string, unknown>) =>
  send<Payslip>(`/finance/payroll/payslips/${id}`, "PATCH", body);

export const markPayslipPaid = (
  id: string,
  body: { payment_method?: string; paid_at?: string } = {}
) => send<Payslip>(`/finance/payroll/payslips/${id}/mark-paid`, "PATCH", body);

export const deletePayslip = (id: string) =>
  send<Payslip>(`/finance/payroll/payslips/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type CollectionsReport = {
  period: { from: string; to: string };
  monthly: MonthlyCollection[];
  by_payment_method: PaymentMethodTotal[];
  total_collected: string;
  transaction_count: number;
};

export type Defaulter = {
  student_name: string;
  student_number: string;
  fee: string;
  amount_due: string;
  amount_paid: string;
  balance: string;
  due_date: string;
  status: string;
};

export type ExpenseByCategory = { category: string; amount: string; count: number };

export type PayrollSummaryRow = {
  department: string;
  employees: number;
  gross: string;
  deductions: string;
  net: string;
};

export type InventoryValuation = {
  items: {
    id: string;
    code: string;
    item_name: string;
    supplier_name: string | null;
    quantity: number;
    unit_cost: string;
    total_value: string;
    is_low_stock: boolean;
  }[];
  total_value: string;
  low_stock_count: number;
};

export const getCollectionsReport = (params: Period = {}) =>
  get<CollectionsReport>(`/finance/reports/collections${query(params)}`);

export const getDefaultersReport = (params: { limit?: number } = {}) =>
  get<Defaulter[]>(`/finance/reports/defaulters${query(params)}`);

export const getExpensesByCategory = (params: Period = {}) =>
  get<ExpenseByCategory[]>(`/finance/reports/expenses-by-category${query(params)}`);

export const getPayrollSummary = (params: { payroll_run_id?: string } = {}) =>
  get<PayrollSummaryRow[]>(`/finance/reports/payroll-summary${query(params)}`);

export const getInventoryValuation = () =>
  get<InventoryValuation>("/finance/reports/inventory-valuation");

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export type FinanceAuditEntry = {
  id: string;
  action: string;
  module: string;
  resource_type: string;
  resource_id: string;
  entity: string | null;
  performed_by: string | null;
  role: string | null;
  actor_type: string | null;
  severity: string;
  timestamp: string;
};

export type FinanceAuditMeta = {
  page: number;
  limit: number;
  total: number;
  modules_tracked: number;
  by_module: { module: string; resource_type: string; count: number }[];
};

export const listFinanceAuditLogs = (
  params: {
    page?: number;
    limit?: number;
    order?: "asc" | "desc";
    q?: string;
    module?: string;
    resource_type?: string;
    actor_id?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  } = {}
) => getWithMeta<FinanceAuditEntry[], FinanceAuditMeta>(`/finance/audit-logs${query(params)}`);

export const listFinanceAuditModules = () => get<string[]>("/finance/audit-logs/modules");

// ---------------------------------------------------------------------------
// Fee structures / assignments / transactions (pre-existing endpoints)
// ---------------------------------------------------------------------------

export type FeeStructure = {
  id: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string | null;
  class_name?: string | null;
  name: string;
  amount: string;
  currency: string;
  is_mandatory: boolean;
  due_date: string | null;
};

export const listFeeStructures = (
  params: ListParams & { academic_year_id?: string; term_id?: string; class_id?: string } = {}
) => getWithMeta<FeeStructure[]>(`/fees/structures${query(params)}`);

export const createFeeStructure = (body: {
  academic_year_id: string;
  name: string;
  amount: number | string;
  term_id?: string;
  class_id?: string;
  currency?: string;
  is_mandatory?: boolean;
  due_date?: string;
}) => send<FeeStructure>("/fees/structures", "POST", body);

export const updateFeeStructure = (id: string, body: Record<string, unknown>) =>
  send<FeeStructure>(`/fees/structures/${id}`, "PATCH", body);

export const deleteFeeStructure = (id: string) =>
  send<FeeStructure>(`/fees/structures/${id}`, "DELETE");

export type FeeAssignment = {
  id: string;
  student_id: string;
  student_name?: string | null;
  student_number?: string | null;
  fee_structure_id: string;
  fee_name?: string | null;
  amount_due: string;
  amount_paid: string;
  balance: string;
  status: "unpaid" | "partial" | "paid" | "waived" | "overdue";
  due_date: string | null;
};

export const listFeeAssignments = (
  params: ListParams & { student_id?: string; fee_structure_id?: string; status?: string } = {}
) => getWithMeta<FeeAssignment[]>(`/fees/assignments${query(params)}`);

export type FeeTransaction = {
  id: string;
  receipt_number: string;
  student_id: string;
  student_name?: string | null;
  fee_assignment_id: string | null;
  amount: string;
  payment_method: string | null;
  payment_ref: string | null;
  paid_at: string;
  notes: string | null;
  receipt_url?: string | null;
  received_by_name?: string | null;
};

export const listFeeTransactions = (
  params: ListParams & {
    student_id?: string;
    fee_assignment_id?: string;
    from_date?: string;
    to_date?: string;
  } = {}
) => getWithMeta<FeeTransaction[]>(`/fees/transactions${query(params)}`);

export const createFeeTransaction = (body: {
  student_id: string;
  amount: number | string;
  fee_assignment_id?: string;
  payment_method?: string;
  payment_ref?: string;
  paid_at?: string;
  notes?: string;
}) => send<FeeTransaction>("/fees/transactions", "POST", body);

export const uploadTransactionReceipt = (id: string, file: File) =>
  upload<FeeTransaction>(`/fees/transactions/${id}/receipt`, "receipt", file);

export const getStudentBalance = (studentId: string) =>
  get<{
    student_id: string;
    student_name: string;
    total_due: string;
    total_paid: string;
    balance: string;
    assignments: FeeAssignment[];
  }>(`/fees/students/${studentId}/balance`);

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

export const paymentMethodLabel = (value?: string | null) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.label ??
  (value ? value.replace(/_/g, " ") : "--");
