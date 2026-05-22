import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Phone, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StaffModal } from "@/components/staff/ui";
import { LEAVE_REQUESTS, type LeaveRequest } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/staff/leaves")({ component: StaffLeaves });

const SMS_PREVIEW =
  "Muraho! Leave y'umwana wanyu [Student] yemejwe kuva [Start] kugeza [End]. Murakoze. — GSPK Staff";

function StaffLeaves() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all" | "exit">("pending");
  const [list, setList] = useState(LEAVE_REQUESTS);
  const [open, setOpen] = useState<LeaveRequest | null>(null);
  const [staffNotes, setStaffNotes] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [loading, setLoading] = useState(false);

  const filtered = list.filter((l) => {
    if (tab === "all") return true;
    if (tab === "exit") return l.status === "Approved" && !l.actualReturn;
    return l.status.toLowerCase() === tab;
  });

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setList((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status, decidedBy: "Nkurunziza Patrick", staffNotes } : l,
      ),
    );
    setLoading(false);
    toast.success(`Leave ${status.toLowerCase()}${status === "Approved" && sendSms ? " — SMS sent" : ""}`);
    setOpen(null);
    setStaffNotes("");
  };

  const isOverdue = (l: LeaveRequest) => {
    if (!l.expectedReturn) return false;
    return new Date(l.expectedReturn) < new Date();
  };

  return (
    <StaffLayout title="Leave Requests" subtitle="Approve, reject and track student leaves">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard label="Pending Approval" value={list.filter((l) => l.status === "Pending").length} icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Approved Today" value={list.filter((l) => l.status === "Approved").length} icon={<Check className="h-5 w-5" />} tone="success" />
        <StatCard label="Rejected Today" value={list.filter((l) => l.status === "Rejected").length} icon={<X className="h-5 w-5" />} tone="destructive" />
        <StatCard label="Currently On Leave" value={list.filter((l) => l.status === "Approved" && !l.actualReturn).length} icon={<AlertTriangle className="h-5 w-5" />} tone="primary" />
      </div>

      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {(["pending", "approved", "rejected", "all", "exit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize whitespace-nowrap border-b-2 ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "exit" ? "Exit Tracking" : t === "all" ? "All Leaves" : t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Class</th>
              {tab !== "exit" && <th className="text-left p-3">Type</th>}
              <th className="text-left p-3">Dates</th>
              {tab === "pending" && <th className="text-left p-3">Reason</th>}
              {tab === "exit" && (
                <>
                  <th className="text-left p-3">Expected Return</th>
                  <th className="text-left p-3">Status</th>
                </>
              )}
              {tab !== "exit" && <th className="text-left p-3">Parent</th>}
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-muted-foreground">
                  No leave requests
                </td>
              </tr>
            ) : (
              filtered.map((l, i) => {
                const overdue = tab === "exit" && isOverdue(l);
                return (
                  <tr
                    key={l.id}
                    className={`border-t ${overdue ? "bg-destructive/5" : i % 2 ? "bg-muted/30" : ""}`}
                  >
                    <td className="p-3 font-medium">{l.studentName}</td>
                    <td className="p-3">
                      {l.class} · {l.dorm}
                    </td>
                    {tab !== "exit" && (
                      <td className="p-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {l.type}
                        </span>
                      </td>
                    )}
                    <td className="p-3 text-xs">
                      {l.startDate} → {l.endDate}
                    </td>
                    {tab === "pending" && (
                      <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate">
                        {l.reason}
                      </td>
                    )}
                    {tab === "exit" && (
                      <>
                        <td className="p-3 font-mono text-xs">{l.expectedReturn ?? "—"}</td>
                        <td className="p-3">
                          {overdue ? (
                            <span className="text-destructive font-semibold text-xs">OVERDUE</span>
                          ) : (
                            <span className="text-primary text-xs">Out</span>
                          )}
                        </td>
                      </>
                    )}
                    {tab !== "exit" && (
                      <td className="p-3 text-xs">
                        <div>{l.parentName}</div>
                        <div className="text-muted-foreground">{l.parentPhone}</div>
                      </td>
                    )}
                    <td className="p-3">
                      {tab === "exit" ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => toast.success(`${l.studentName} marked returned`)}
                            className="text-xs text-primary font-semibold hover:underline text-left"
                          >
                            Mark Returned
                          </button>
                          {overdue && (
                            <button
                              type="button"
                              onClick={() => toast.success("Reminder SMS sent")}
                              className="text-xs text-destructive font-semibold hover:underline text-left"
                            >
                              Send Reminder SMS
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpen(l)}
                          className="text-xs text-primary font-semibold hover:underline"
                        >
                          {l.status === "Pending" ? "Review" : "View"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <StaffModal
        open={!!open}
        onClose={() => !loading && setOpen(null)}
        title={open?.status === "Pending" ? "Review leave request" : "Leave details"}
        wide
        footer={
          open?.status === "Pending" ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => decide(open.id, "Rejected")}
                className="flex-1 h-10 rounded-md bg-destructive text-destructive-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject Leave
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => decide(open.id, "Approved")}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve Leave
              </button>
            </div>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary font-bold">
                {open.studentName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="font-display font-bold text-lg">{open.studentName}</div>
                <div className="text-muted-foreground">
                  {open.class} · {open.dorm}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Parent</div>
              <a href={`tel:${open.parentPhone}`} className="font-medium text-primary inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {open.parentName} · {open.parentPhone}
              </a>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Leave dates</div>
              <div>
                {open.startDate} → {open.endDate}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Reason</div>
              <div>{open.reason}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Previous leaves this term: 2 approved, 1 rejected
            </div>
            {open.status === "Pending" && (
              <>
                <textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Staff notes (optional)..."
                  className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[60px]"
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
                  Send approval SMS to parent
                </label>
                {sendSms && (
                  <div className="rounded-lg bg-muted p-3 text-xs font-mono">
                    {SMS_PREVIEW.replace("[Student]", open.studentName)
                      .replace("[Start]", open.startDate)
                      .replace("[End]", open.endDate)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </StaffModal>
    </StaffLayout>
  );
}
