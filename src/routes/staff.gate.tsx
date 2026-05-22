import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScanLine, LogOut as ExitIcon, AlertTriangle, Printer, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import {
  TODAY_GATE_LOG, PENDING_EXITS, UNAUTHORIZED_GATE_ALERTS,
} from "@/lib/teacherStaffData";
import { LockdownDialog, StaffModal, campusStatusStyle, type CampusStatus } from "@/components/staff/ui";

export const Route = createFileRoute("/staff/gate")({ component: GateControl });

function GateControl() {
  const [tab, setTab] = useState<"today" | "pending" | "alerts">("today");
  const [scanning, setScanning] = useState<"in" | "out" | null>(null);
  const [last, setLast] = useState<{ name: string; class: string; time: string; type: string } | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [dupModal, setDupModal] = useState<{ name: string; time: string } | null>(null);
  const [lockStep, setLockStep] = useState<0 | 1 | 2>(0);
  const campusStatus: CampusStatus = "OPEN";
  const statusStyle = campusStatusStyle(campusStatus);

  const simulate = (type: "in" | "out") => {
    const now = Date.now();
    if (lastScanTime && now - lastScanTime < 5 * 60 * 1000 && last) {
      setDupModal({ name: last.name, time: last.time });
      return;
    }
    setScanning(type);
    setTimeout(() => {
      const s = TODAY_GATE_LOG[Math.floor(Math.random() * TODAY_GATE_LOG.length)];
      const time = new Date().toLocaleTimeString();
      setLast({ name: s.studentName, class: s.class, time, type: type === "in" ? "Entry" : "Exit" });
      setLastScanTime(now);
      toast.success(`${type === "in" ? "Check-in" : "Check-out"}: ${s.studentName}`);
      setScanning(null);
    }, 1500);
  };

  const confirmDup = () => {
    setDupModal(null);
    setLastScanTime(null);
    toast.info("Re-entry confirmed");
  };

  return (
    <StaffLayout title="Gate Control">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase px-3 py-1 rounded-full ${statusStyle.badge}`}>
          <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
          Campus {campusStatus}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ScanLine className="h-6 w-6 text-primary" />
            <h3 className="font-display font-bold text-lg">Scan Entry</h3>
          </div>
          <button
            type="button"
            onClick={() => simulate("in")}
            disabled={scanning !== null}
            className="w-full h-24 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold border-2 border-dashed border-primary/40 disabled:opacity-50"
          >
            {scanning === "in" ? "Scanning..." : "Scan Student ID"}
          </button>
          <div className="mt-3 flex gap-2">
            <input placeholder="Manual ID..." className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm" />
            <button type="button" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
              Check In
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ExitIcon className="h-6 w-6 text-amber-600" />
            <h3 className="font-display font-bold text-lg">Scan Exit</h3>
          </div>
          <button
            type="button"
            onClick={() => simulate("out")}
            disabled={scanning !== null}
            className="w-full h-24 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold border-2 border-dashed border-amber-400 disabled:opacity-50"
          >
            {scanning === "out" ? "Scanning..." : "Scan for Exit"}
          </button>
          <div className="mt-3 flex gap-2">
            <input placeholder="Manual ID..." className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm" />
            <button type="button" className="h-9 px-4 rounded-md border border-border text-sm font-semibold">
              Check Out
            </button>
          </div>
        </div>
      </div>

      {last && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mb-5 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div className="text-sm">
            <b>{last.name}</b> ({last.class}) — {last.type} at {last.time}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 border-b border-border">
          {(
            [
              ["today", "Today's Log"],
              ["pending", `Pending Exits (${PENDING_EXITS.length})`],
              ["alerts", "Unauthorized Alerts"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 ${
                tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm mb-20">
        {tab === "today" && (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Officer</th>
                <th className="text-left p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {TODAY_GATE_LOG.map((g, i) => (
                <tr key={g.id} className={`border-t ${g.flag ? "bg-destructive/5" : i % 2 ? "bg-muted/30" : ""}`}>
                  <td className="p-3 font-mono">{g.time}</td>
                  <td className="p-3 font-medium">{g.studentName}</td>
                  <td className="p-3">{g.class}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        g.type === "entry" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {g.type}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{g.method}</td>
                  <td className="p-3 text-muted-foreground">{g.officer}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {g.flag ? <span className="text-destructive font-semibold">⚠️ {g.flag}</span> : g.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "pending" && (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Exit Time</th>
                <th className="text-left p-3">Expected Return</th>
                <th className="text-left p-3">Overdue</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {PENDING_EXITS.map((p, i) => (
                <tr key={p.studentId} className={`border-t ${p.overdue ? "bg-destructive/5" : i % 2 ? "bg-muted/30" : ""}`}>
                  <td className="p-3 font-medium">{p.studentName}</td>
                  <td className="p-3">{p.class}</td>
                  <td className="p-3 font-mono">{p.exitTime}</td>
                  <td className="p-3 font-mono">{p.expectedReturn}</td>
                  <td className="p-3">
                    {p.overdue ? (
                      <span className="text-destructive font-semibold text-xs">OVERDUE</span>
                    ) : (
                      <span className="text-primary text-xs">On time</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => toast.success("Marked returned")} className="text-xs text-primary font-semibold hover:underline mr-3">
                      Mark Returned
                    </button>
                    <button type="button" onClick={() => toast.success("Parent alerted")} className="text-xs text-amber-700 font-semibold hover:underline">
                      Alert Parent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "alerts" && (
          <div className="p-4 space-y-2">
            {UNAUTHORIZED_GATE_ALERTS.map((a) => (
              <div key={a.id} className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1 text-sm">
                  <b>{a.studentName}</b> ({a.class}) — {a.description}
                  <div className="text-xs text-muted-foreground mt-0.5">{a.time}</div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    a.severity === "HIGH" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {a.severity}
                </span>
                <button type="button" className="text-xs font-semibold text-destructive hover:underline">
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t border-border bg-background/95 backdrop-blur px-4 md:px-8 py-3 flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={() => toast.success("All students marked present")} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          All Students Present
        </button>
        <button type="button" onClick={() => setLockStep(1)} className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> Emergency Lockdown
        </button>
        <button type="button" onClick={() => window.print()} className="h-9 px-4 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1">
          <Printer className="h-3 w-3" /> Print Today&apos;s Log
        </button>
      </div>

      <LockdownDialog
        open={lockStep > 0}
        step={lockStep as 1 | 2}
        onClose={() => setLockStep(0)}
        onConfirm={() => {
          if (lockStep === 1) setLockStep(2);
          else {
            toast.error("Emergency lockdown activated");
            setLockStep(0);
          }
        }}
      />

      <StaffModal
        open={!!dupModal}
        onClose={() => setDupModal(null)}
        title="Duplicate scan"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setDupModal(null)} className="flex-1 h-10 rounded-md border border-border font-semibold text-sm">
              Cancel
            </button>
            <button type="button" onClick={confirmDup} className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-semibold text-sm">
              Confirm Re-entry
            </button>
          </div>
        }
      >
        {dupModal && (
          <p className="text-sm">
            ⚠️ <b>{dupModal.name}</b> was already checked in at {dupModal.time}. Is this a re-entry?
          </p>
        )}
      </StaffModal>
    </StaffLayout>
  );
}
