import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Users, FileText, UserCheck, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  STAFF_ME, LEAVE_REQUESTS, TODAY_GATE_LOG,
  STAFF_DASHBOARD_TASKS, STAFF_RECENT_ACTIVITY,
} from "@/lib/teacherStaffData";
import { LockdownDialog, campusStatusStyle, type CampusStatus } from "@/components/staff/ui";

export const Route = createFileRoute("/staff/dashboard")({ component: StaffDashboard });

function StaffDashboard() {
  const [campusStatus] = useState<CampusStatus>("OPEN");
  const [tasks, setTasks] = useState(STAFF_DASHBOARD_TASKS);
  const [lockStep, setLockStep] = useState<0 | 1 | 2>(0);
  const pending = LEAVE_REQUESTS.filter((l) => l.status === "Pending").length;
  const statusStyle = campusStatusStyle(campusStatus);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  return (
    <StaffLayout
      title={`Good morning, ${STAFF_ME.name.split(" ")[0]}`}
      subtitle={`${today}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1 rounded-full bg-primary/10 text-primary">
          {STAFF_ME.role}
        </span>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On Campus Now" value="624" icon={<Users className="h-5 w-5" />} trend="updated live" tone="success" />
        <StatCard label="Pending Leaves" value={pending} icon={<FileText className="h-5 w-5" />} trend="awaiting approval" tone="warning" />
        <StatCard label="Visitors Today" value="14" icon={<UserCheck className="h-5 w-5" />} trend="3 on campus" tone="primary" />
        <StatCard label="Absent Boarders" value="2" icon={<AlertTriangle className="h-5 w-5" />} trend="needs follow-up" tone="destructive" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Live Campus Status</h3>
            <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase px-3 py-1 rounded-full ${statusStyle.badge}`}>
              <span className={`h-2 w-2 rounded-full ${statusStyle.dot} animate-pulse`} />
              {campusStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">{TODAY_GATE_LOG.filter((g) => g.type === "entry").length}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Entries</div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">{TODAY_GATE_LOG.filter((g) => g.type === "exit").length}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Exits</div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">2</div>
              <div className="text-[10px] uppercase text-muted-foreground">Expected Returns</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLockStep(1)}
            className="w-full h-11 rounded-md bg-destructive text-destructive-foreground font-bold inline-flex items-center justify-center gap-2 hover:bg-destructive/90"
          >
            <Lock className="h-4 w-4" /> Emergency Lockdown
          </button>
          <LockdownDialog
            open={lockStep > 0}
            step={lockStep as 1 | 2}
            onClose={() => setLockStep(0)}
            onConfirm={() => {
              if (lockStep === 1) setLockStep(2);
              else {
                toast.error("Emergency lockdown activated — all staff notified");
                setLockStep(0);
              }
            }}
          />

          <div className="mt-5">
            <h4 className="font-semibold text-sm mb-2">Today&apos;s Tasks</h4>
            <div className="space-y-2 text-sm">
              {tasks.map((x) => (
                <div key={x.id} className="flex items-center gap-3 p-2 rounded border border-border">
                  <input
                    type="checkbox"
                    checked={x.done}
                    onChange={() =>
                      setTasks((prev) =>
                        prev.map((t) => (t.id === x.id ? { ...t, done: !t.done } : t)),
                      )
                    }
                  />
                  <div className="flex-1">{x.label}</div>
                  <div className="text-xs text-muted-foreground">{x.time}</div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      x.done ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {x.done ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
          <h3 className="font-display font-bold text-lg mb-4">Recent Activity</h3>
          <div className="space-y-3 text-sm">
            {STAFF_RECENT_ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                <div
                  className={`mt-1.5 h-2 w-2 rounded-full ${
                    a.tone === "destructive" ? "bg-destructive" : "bg-primary"
                  }`}
                />
                <div className="flex-1">
                  <div>{a.text}</div>
                  <div className="text-[11px] text-muted-foreground">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/staff/leaves" className="mt-3 block text-xs text-primary font-semibold hover:underline">
            View all leaves →
          </Link>
        </div>
      </div>
    </StaffLayout>
  );
}
