import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Search, X, Printer, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { STUDENTS, STUDENT_FEES, TRANSACTIONS, FEE_STRUCTURE, schoolConfig, formatRWF, SUBSCRIPTION_INVOICES, subscriptionPlan, PLAN_OPTIONS, type StudentFee, type FeeTransaction, type SubscriptionInvoice } from "@/lib/mockData";
import { Check, X as XIcon, Download } from "lucide-react";

export const Route = createFileRoute("/fees")({ component: FeesPage });

const TABS = ["Fee Dashboard", "Student Fees", "Transaction Logs", "Fee Structure", "Reminders", "Subscription"] as const;

function FeesPage() {
  const subscriptionOnly = true;
  const [tab, setTab] = useState<typeof TABS[number]>(subscriptionOnly ? "Subscription" : "Fee Dashboard");
  const expected = STUDENT_FEES.reduce((s, f) => s + f.total, 0);
  const collected = STUDENT_FEES.reduce((s, f) => s + f.paid, 0);
  const outstanding = expected - collected;
  const overdue = STUDENT_FEES.filter(f => f.status === "Overdue").reduce((s, f) => s + f.balance, 0);
  const month = TRANSACTIONS.reduce((s, t) => s + t.amount, 0);

  return (
    <AppLayout title="Fee Management" subtitle="Tuition, boarding & activity fees — Amafaranga">
      <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 ${subscriptionOnly ? "hidden" : ""}`}>
        <StatCard label="Total Expected" value={formatRWF(expected)} />
        <StatCard label="Collected" value={formatRWF(collected)} tone="success" />
        <StatCard label="Outstanding" value={formatRWF(outstanding)} />
        <StatCard label="Overdue (30+)" value={formatRWF(overdue)} tone="destructive" />
        <StatCard label="This Month" value={formatRWF(month)} tone="success" />
      </div>

      <div className={`flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto ${subscriptionOnly ? "hidden" : ""}`}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {!subscriptionOnly && tab === "Fee Dashboard" && <DashboardTab />}
      {!subscriptionOnly && tab === "Student Fees" && <StudentFeesTab />}
      {!subscriptionOnly && tab === "Transaction Logs" && <TransactionLogsTab />}
      {!subscriptionOnly && tab === "Fee Structure" && <FeeStructureTab />}
      {!subscriptionOnly && tab === "Reminders" && <RemindersTab />}
      {(subscriptionOnly || tab === "Subscription") && <SubscriptionTab />}
    </AppLayout>
  );
}

function DashboardTab() {
  const daily = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, amount: 50000 + ((i * 17) % 250000) }));
  const byClass = ["S1","S2","S3","S4","S5","S6"].map(lvl => ({
    level: lvl,
    collected: STUDENT_FEES.filter(f => STUDENTS.find(s => s.id === f.studentId)?.class.startsWith(lvl)).reduce((s, f) => s + f.paid, 0),
  }));
  const methods = ["Cash","MTN MoMo","Airtel Money","Bank Transfer","Cheque"].map(m => ({
    name: m, value: TRANSACTIONS.filter(t => t.method === m).reduce((s, t) => s + t.amount, 0),
  }));
  const COLORS = ["#3b5998","#545f72","#f59e0b","#ef4444","#6366f1"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Daily Collections (This Month)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v: number) => formatRWF(v)} />
              <Area dataKey="amount" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} /></AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Collection by Class Level">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byClass}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="level" /><YAxis /><Tooltip formatter={(v: number) => formatRWF(v)} />
              <Bar dataKey="collected" fill="#3b5998" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Payment Methods">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart><Pie data={methods} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
              {methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatRWF(v)} /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Recent Transactions">
          <div className="space-y-2">
            {TRANSACTIONS.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div><div className="font-medium">{t.studentName}</div><div className="text-xs text-muted-foreground">{t.method} · {t.date}</div></div>
                <div className="font-bold text-success">{formatRWF(t.amount)}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function StudentFeesTab() {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("All");
  const [status, setStatus] = useState("All");
  const [paying, setPaying] = useState<StudentFee | null>(null);
  const [receipt, setReceipt] = useState<{ tx: FeeTransaction; balance: number } | null>(null);

  const rows = useMemo(() => STUDENT_FEES.map(f => ({ fee: f, student: STUDENTS.find(s => s.id === f.studentId)! }))
    .filter(r => (q === "" || r.student.name.toLowerCase().includes(q.toLowerCase())) &&
      (cls === "All" || r.student.class === cls) && (status === "All" || r.fee.status === status))
    .slice(0, 30), [q, cls, status]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by student name..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={cls} onChange={e => setCls(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{["S1A","S1B","S2A","S2B","S3A","S3B","S4A","S4B","S5A","S5B","S6A","S6B"].map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>Overdue</option>
        </select>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Student","Class","Total","Paid","Balance","Last Payment","Status","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ fee, student }) => (
                <tr key={fee.studentId} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3">{student.class}</td>
                  <td className="px-4 py-3">{formatRWF(fee.total)}</td>
                  <td className="px-4 py-3 text-success font-semibold">{formatRWF(fee.paid)}</td>
                  <td className="px-4 py-3 text-destructive font-semibold">{formatRWF(fee.balance)}</td>
                  <td className="px-4 py-3 text-xs">{fee.lastPayment}</td>
                  <td className="px-4 py-3"><FeeStatus v={fee.status} /></td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    <button onClick={() => setPaying(fee)} className="text-xs font-semibold text-primary hover:underline">Record Payment</button>
                    <button onClick={() => toast.success(`Reminder SMS sent to ${student.parentName}`)} className="text-xs font-semibold text-muted-foreground hover:underline">Remind</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {paying && <RecordPaymentModal fee={paying} onClose={() => setPaying(null)} onPosted={(tx, bal) => { setPaying(null); setReceipt({ tx, balance: bal }); }} />}
      {receipt && <ReceiptModal tx={receipt.tx} balance={receipt.balance} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function FeeStatus({ v }: { v: StudentFee["status"] }) {
  const map = { Paid: ["bg-success/15 text-success","🟢 Paid"], Partial: ["bg-amber-100 text-amber-700","🟡 Partial"], Unpaid: ["bg-destructive/15 text-destructive","🔴 Unpaid"], Overdue: ["bg-slate-200 text-slate-700","⚫ Overdue"] } as const;
  const [c, l] = map[v];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${c}`}>{l}</span>;
}

function RecordPaymentModal({ fee, onClose, onPosted }: { fee: StudentFee; onClose: () => void; onPosted: (tx: FeeTransaction, balance: number) => void }) {
  const student = STUDENTS.find(s => s.id === fee.studentId)!;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<FeeTransaction["method"]>("MTN MoMo");
  const [ref, setRef] = useState("");
  const submit = () => {
    const amt = parseInt(amount.replace(/\D/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid positive amount"); return; }
    const tx: FeeTransaction = {
      id: `TXN-${Date.now()}`, receiptNo: `RCP-2026-${String(500 + TRANSACTIONS.length).padStart(4,"0")}`,
      date: new Date().toISOString().slice(0,10), studentId: student.id, studentName: student.name, class: student.class,
      amount: amt, method, reference: ref || `${method}-${Date.now()}`, collectedBy: "Mukamana Grace (Accountant)", status: "Completed",
    };
    toast.success(`Payment of ${formatRWF(amt)} recorded`);
    onPosted(tx, Math.max(0, fee.balance - amt));
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-bold">Record Payment</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3"><div className="font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.class} · Balance: <span className="text-destructive font-bold">{formatRWF(fee.balance)}</span></div></div>
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-2">Fee Breakdown</div>
            <div className="space-y-1 text-sm">
              {FEE_STRUCTURE.map(f => <div key={f.name} className="flex justify-between border-b border-border py-1"><span>{f.name}</span><span className="font-mono">{formatRWF(f.amounts[student.class.slice(0,2)] || 0)}</span></div>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (RWF) *" value={amount} onChange={setAmount} placeholder="50000" />
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value as any)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {["Cash","MTN MoMo","Airtel Money","Bank Transfer","Cheque"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <Field label="Reference" value={ref} onChange={setRef} placeholder="MoMo TX ID" />
            <Field label="Collected By" value="Mukamana Grace" onChange={() => {}} disabled />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">Post Payment</button>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ tx, balance, onClose }: { tx: FeeTransaction; balance: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <div className="text-xs uppercase tracking-wider">Inyemeza · Receipt</div>
          <div className="font-display font-bold text-xl mt-1">{schoolConfig.schoolName}</div>
          <div className="text-xs opacity-90 mt-1">Receipt #: {tx.receiptNo}</div>
        </div>
        <div className="px-6 py-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{tx.date}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-semibold">{tx.studentName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Class</span><span className="font-semibold">{tx.class}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-semibold">{tx.method}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{tx.reference}</span></div>
          <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
            <span className="font-bold">Amount Paid</span><span className="font-display text-2xl font-bold text-success">{formatRWF(tx.amount)}</span>
          </div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining Balance</span><span className="font-semibold">{formatRWF(balance)}</span></div>
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">School stamp & signature</div>
        </div>
        <div className="px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
          <button onClick={() => toast.success("Receipt PDF generated")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Download PDF</button>
          <button onClick={() => toast.success("Sent to parent via SMS")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90"><Send className="h-4 w-4" /> Send SMS</button>
        </div>
      </div>
    </div>
  );
}

function TransactionLogsTab() {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const totalAmount = TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
  const slice = TRANSACTIONS.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">{TRANSACTIONS.length} transactions · Total: <span className="font-bold text-foreground">{formatRWF(totalAmount)}</span></div>
        <button onClick={() => toast.success("CSV exported")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Export CSV</button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Receipt #","Date","Student","Class","Amount","Method","Collected By","Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {slice.map(t => (
                <tr key={t.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{t.receiptNo}</td>
                  <td className="px-4 py-3 text-xs">{t.date}</td>
                  <td className="px-4 py-3 font-medium">{t.studentName}</td>
                  <td className="px-4 py-3">{t.class}</td>
                  <td className="px-4 py-3 font-semibold text-success">{formatRWF(t.amount)}</td>
                  <td className="px-4 py-3 text-xs">{t.method}</td>
                  <td className="px-4 py-3 text-xs">{t.collectedBy}</td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-bold">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center px-4 py-3 border-t border-border text-xs">
          <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(TRANSACTIONS.length / pageSize)}</span>
          <div className="space-x-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border border-border px-3 py-1 disabled:opacity-50">Prev</button>
            <button disabled={(page + 1) * pageSize >= TRANSACTIONS.length} onClick={() => setPage(p => p + 1)} className="rounded border border-border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeeStructureTab() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">Term fee configuration per level</div>
        <button onClick={() => toast.info("Fee item modal — placeholder")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Add Fee Item</button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-4 py-3">Fee Item</th>{["S1","S2","S3","S4","S5","S6"].map(l => <th key={l} className="text-right px-4 py-3">{l}</th>)}<th className="text-center px-4 py-3">Mandatory</th></tr></thead>
          <tbody>
            {FEE_STRUCTURE.map(f => (
              <tr key={f.name} className="border-t border-border odd:bg-background even:bg-muted/20">
                <td className="px-4 py-3 font-medium">{f.name}</td>
                {["S1","S2","S3","S4","S5","S6"].map(l => <td key={l} className="px-4 py-3 text-right font-mono text-xs">{formatRWF(f.amounts[l] || 0)}</td>)}
                <td className="px-4 py-3 text-center">{f.mandatory ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RemindersTab() {
  const [target, setTarget] = useState("All Unpaid");
  const [tpl, setTpl] = useState(`Dear {parentName}, school fees balance for {studentName} is RWF {amount}. Please pay by {dueDate} to avoid penalties. — ${schoolConfig.schoolName}`);
  const count = target === "All Unpaid" ? STUDENT_FEES.filter(f => f.status !== "Paid").length : target === "Overdue 30+ days" ? STUDENT_FEES.filter(f => f.status === "Overdue").length : 24;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-bold mb-3">Target Recipients</div>
        <select value={target} onChange={e => setTarget(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm mb-3">
          <option>All Unpaid</option><option>Overdue 30+ days</option><option>Specific Class</option>
        </select>
        <div className="text-sm text-muted-foreground mb-2">SMS Template</div>
        <textarea value={tpl} onChange={e => setTpl(e.target.value)} rows={5} className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
        <div className="text-xs text-muted-foreground mt-2">{tpl.length} chars · {Math.ceil(tpl.length / 160)} SMS</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
        <div className="text-sm font-bold mb-3">Send Reminders</div>
        <div className="rounded-lg bg-primary/5 p-4 mb-4">
          <div className="text-3xl font-display font-bold text-primary">{count}</div>
          <div className="text-xs text-muted-foreground">parents will be notified</div>
        </div>
        <div className="text-xs text-muted-foreground mb-3">Estimated cost: RWF {(count * 25).toLocaleString()}</div>
        <button onClick={() => toast.success(`Sending to ${count} parents...`)} className="mt-auto rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold">Send to {count} Parents</button>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="font-display font-bold mb-3">{title}</div>{children}</div>;
}
function Field({ label, value, onChange, placeholder, disabled }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
    </div>
  );
}

// =================== Subscription Tab ===================
function SubscriptionTab() {
  const [viewing, setViewing] = useState<SubscriptionInvoice | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const p = subscriptionPlan;
  const statusColor = p.current.status === "Active" ? "bg-success/15 text-success" : p.current.status === "Expired" ? "bg-destructive/15 text-destructive" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-5">
      {/* Current Plan Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-primary/10 text-primary">{p.current.name}</span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>{p.current.status}</span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground">{p.current.cycle} billing</span>
            </div>
            <div className="font-display text-3xl font-bold">{formatRWF(p.current.amount)} <span className="text-sm font-normal text-muted-foreground">/ month</span></div>
            <p className="mt-1 text-sm text-muted-foreground">Next billing date: <span className="font-semibold text-foreground">{p.current.nextBilling}</span></p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {p.current.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success shrink-0" /> {f}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setUpgradeOpen(true)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90">Upgrade Plan</button>
            <button onClick={() => toast.info("Billing portal — placeholder")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Manage Billing</button>
          </div>
        </div>
      </div>

      {/* Usage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageMeter label="Students" used={p.usage.students.used} limit={p.usage.students.limit} unit="" />
        <UsageMeter label="SMS Sent This Month" used={p.usage.sms.used} limit={p.usage.sms.limit} unit="" />
        <UsageMeter label="Staff Accounts" used={p.usage.staff.used} limit={p.usage.staff.limit} unit="" />
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-display font-bold">Invoice History</div>
          <span className="text-xs text-muted-foreground">{SUBSCRIPTION_INVOICES.length} invoices</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Invoice #</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Issue Date</th>
              <th className="px-4 py-3 text-left">Due Date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SUBSCRIPTION_INVOICES.map((inv, i) => (
              <tr key={inv.id} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.id}</td>
                <td className="px-4 py-3">{inv.period}</td>
                <td className="px-4 py-3 text-muted-foreground">{inv.issueDate}</td>
                <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatRWF(inv.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${inv.status === "paid" ? "bg-success/15 text-success" : inv.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-destructive/15 text-destructive"}`}>
                    {inv.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => toast.success(`Downloading ${inv.id}.pdf`)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Download PDF"><Download className="h-4 w-4" /></button>
                    <button onClick={() => setViewing(inv)} className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted">View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && <InvoiceModal invoice={viewing} onClose={() => setViewing(null)} />}
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-display text-2xl font-bold">{used.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">of {limit.toLocaleString()}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{pct}% used</div>
    </div>
  );
}

function InvoiceModal({ invoice, onClose }: { invoice: SubscriptionInvoice; onClose: () => void }) {
  const subtotal = invoice.items.reduce((s, i) => s + i.amount, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold">Invoice {invoice.id}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-xl font-bold text-primary">ecareafrica</div>
              <p className="text-xs text-muted-foreground">Platform billing</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Billed to</div>
              <div className="font-semibold">{schoolConfig.schoolName}</div>
              <div className="text-xs text-muted-foreground">Period: {invoice.period}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={i} className="border-t border-border"><td className="px-4 py-2.5">{it.label}</td><td className="px-4 py-2.5 text-right font-mono">{formatRWF(it.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t border-border"><td className="px-4 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-4 py-2 text-right font-mono">{formatRWF(subtotal)}</td></tr>
              <tr><td className="px-4 py-2 text-right text-muted-foreground">VAT (18%)</td><td className="px-4 py-2 text-right font-mono">{formatRWF(tax)}</td></tr>
              <tr className="border-t border-border bg-muted/30"><td className="px-4 py-3 text-right font-bold">Total</td><td className="px-4 py-3 text-right font-bold text-primary">{formatRWF(total)}</td></tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${invoice.status === "paid" ? "bg-success/15 text-success" : invoice.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-destructive/15 text-destructive"}`}>
              {invoice.status.toUpperCase()}
            </span>
            <div className="flex gap-2">
              <button onClick={() => toast.success("Downloading PDF…")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="h-4 w-4" /> Download PDF</button>
              <button onClick={() => window.print()} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:opacity-90">Print</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [annual, setAnnual] = useState(false);
  const current = subscriptionPlan.current.tier;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold">Choose Your Plan</h2>
            <p className="text-xs text-muted-foreground">Upgrade or change your ecareafrica subscription</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="px-6 pt-4 flex justify-center">
          <label className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm">
            <span className={!annual ? "font-semibold" : "text-muted-foreground"}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className={`relative h-5 w-10 rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
            <span className={annual ? "font-semibold" : "text-muted-foreground"}>Annual <span className="text-success text-xs">(save 20%)</span></span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {PLAN_OPTIONS.map(plan => {
            const isCurrent = plan.id === current;
            const price = annual ? plan.annual : plan.monthly;
            const isPro = plan.id === "professional";
            return (
              <div key={plan.id} className={`rounded-xl border p-5 flex flex-col ${isPro ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border"}`}>
                {isPro && <div className="mb-2 inline-flex self-start rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase">Most Popular</div>}
                <div className="font-display text-xl font-bold">{plan.name}</div>
                <div className="mt-2">
                  <span className="font-display text-3xl font-bold">{formatRWF(price)}</span>
                  <span className="text-sm text-muted-foreground"> / {annual ? "year" : "month"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.studentLimit}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {f.included ? <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> : <XIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                      <span className={f.included ? "" : "text-muted-foreground line-through"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="mt-5 rounded-lg bg-muted text-center py-2 text-sm font-semibold text-muted-foreground">Current Plan</div>
                ) : (
                  <button onClick={() => { toast.success(`Upgrade to ${plan.name} requested`); onClose(); }} className="mt-5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90">
                    {plan.id === "starter" ? "Downgrade" : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
