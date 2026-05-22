import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  UserCheck, LogOut, Search, Printer, Calendar, Clock, Users, Inbox,
  CheckCircle2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StaffModal, EmptyState } from "@/components/staff/ui";
import { VISITORS, STAFF, type Visitor } from "@/lib/mockData";

export const Route = createFileRoute("/staff/visitors")({ component: StaffVisitors });

const TABS = ["Active", "Check-In", "Scheduled", "History"] as const;
type Tab = (typeof TABS)[number];

const PURPOSES: Visitor["purpose"][] = [
  "Parent Visit",
  "Official Business",
  "Delivery",
  "Inspection",
  "Other",
];

function StaffVisitors() {
  const [tab, setTab] = useState<Tab>("Active");
  const [list, setList] = useState<Visitor[]>(VISITORS);
  const [checkoutTarget, setCheckoutTarget] = useState<Visitor | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [historyQ, setHistoryQ] = useState("");
  const [successBadge, setSuccessBadge] = useState<Visitor | null>(null);

  const onCampus = list.filter((v) => v.status === "on-campus");
  const today = list.filter((v) => v.date === "today");
  const scheduled = list.filter((v) => v.status === "scheduled");
  const history = list.filter((v) => v.status === "checked-out");

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (v) =>
          historyQ === "" ||
          v.name.toLowerCase().includes(historyQ.toLowerCase()) ||
          v.host.toLowerCase().includes(historyQ.toLowerCase()),
      ),
    [history, historyQ],
  );

  return (
    <StaffLayout title="Visitor Management" subtitle="Check in and check out campus visitors">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Currently On Campus" value={onCampus.length} tone="success" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Today's Total Visitors" value={today.length} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Awaiting Check-out" value={onCampus.length} tone="warning" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Scheduled Today" value={scheduled.length} icon={<Calendar className="h-5 w-5" />} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Active" && (
        <ActiveTab list={onCampus} onCheckout={setCheckoutTarget} />
      )}
      {tab === "Check-In" && (
        <CheckInTab
          onSuccess={(v) => {
            setList((prev) => [v, ...prev]);
            setSuccessBadge(v);
            setTab("Active");
          }}
        />
      )}
      {tab === "Scheduled" && (
        <ScheduledTab
          list={scheduled}
          onArrive={(id) => {
            setList((prev) =>
              prev.map((v) =>
                v.id === id
                  ? {
                      ...v,
                      status: "on-campus",
                      checkinTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      date: "today",
                    }
                  : v,
              ),
            );
            toast.success("Visitor checked in");
          }}
        />
      )}
      {tab === "History" && (
        <HistoryTab list={filteredHistory} q={historyQ} onQ={setHistoryQ} />
      )}

      {successBadge && (
        <StaffModal
          open
          onClose={() => setSuccessBadge(null)}
          title="Check-in successful"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toast.success("Badge sent to printer")}
                className="flex-1 h-10 rounded-md border border-border font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Badge
              </button>
              <button
                type="button"
                onClick={() => setSuccessBadge(null)}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-semibold text-sm"
              >
                Done
              </button>
            </div>
          }
        >
          <div className="rounded-xl border-2 border-dashed border-primary/30 p-6 text-center bg-primary/5">
            <div className="text-xs uppercase text-muted-foreground mb-2">Visitor Badge</div>
            <div className="flex justify-center">
              <Avatar name={successBadge.name} size="lg" />
            </div>
            <div className="font-display font-bold text-lg mt-3">{successBadge.name}</div>
            <div className="text-sm text-muted-foreground">{successBadge.purpose}</div>
            <div className="text-xs mt-2">Host: {successBadge.host}</div>
            <div className="font-mono text-xs mt-3 text-primary">{successBadge.checkinTime}</div>
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm">
            <input type="checkbox" defaultChecked />
            Auto-SMS host notification
          </label>
        </StaffModal>
      )}

      <StaffModal
        open={!!checkoutTarget}
        onClose={() => {
          setCheckoutTarget(null);
          setCheckoutNotes("");
        }}
        title="Check out visitor"
        footer={
          <button
            type="button"
            disabled={checkoutLoading}
            onClick={async () => {
              if (!checkoutTarget) return;
              setCheckoutLoading(true);
              await new Promise((r) => setTimeout(r, 600));
              setList((prev) =>
                prev.map((v) =>
                  v.id === checkoutTarget.id
                    ? {
                        ...v,
                        status: "checked-out",
                        checkoutTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        notes: checkoutNotes || v.notes,
                      }
                    : v,
                ),
              );
              setCheckoutLoading(false);
              setCheckoutTarget(null);
              setCheckoutNotes("");
              toast.success("Visitor checked out");
            }}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {checkoutLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Check-out
          </button>
        }
      >
        {checkoutTarget && (
          <div className="space-y-3 text-sm">
            <p>
              Check out <b>{checkoutTarget.name}</b>?
            </p>
            <textarea
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              placeholder="Notes (optional)..."
              className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px]"
            />
          </div>
        )}
      </StaffModal>
    </StaffLayout>
  );
}

function StatusPill({ status }: { status: Visitor["status"] }) {
  const map = {
    "on-campus": "bg-success/15 text-success",
    "checked-out": "bg-muted text-muted-foreground",
    scheduled: "bg-amber-100 text-amber-700",
  };
  const label = { "on-campus": "On Campus", "checked-out": "Checked Out", scheduled: "Scheduled" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function durationSince(checkin: string) {
  return "~2h 15m";
}

function ActiveTab({ list, onCheckout }: { list: Visitor[]; onCheckout: (v: Visitor) => void }) {
  if (list.length === 0) {
    return <EmptyState icon={Inbox} message="No visitors currently on campus." />;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Check-in</th>
            <th className="px-4 py-3 text-left">Duration</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={v.id} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={v.name} />
                  <div>
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.phone}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{v.purpose}</td>
              <td className="px-4 py-3">{v.host}</td>
              <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
              <td className="px-4 py-3 text-muted-foreground">{durationSince(v.checkinTime)}</td>
              <td className="px-4 py-3">
                <StatusPill status={v.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onCheckout(v)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <LogOut className="h-3.5 w-3.5" /> Check-out
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckInTab({ onSuccess }: { onSuccess: (v: Visitor) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<Visitor["purpose"]>("Parent Visit");
  const [host, setHost] = useState(STAFF[0]?.name ?? "");
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [hostQ, setHostQ] = useState("");
  const hosts = useMemo(
    () => STAFF.filter((s) => s.name.toLowerCase().includes(hostQ.toLowerCase())).slice(0, 8),
    [hostQ],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Visitor name is required");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const v: Visitor = {
      id: `V-${Date.now()}`,
      name: name.trim(),
      nationalId: nationalId || "—",
      phone: phone || "+250 —",
      organization: "Walk-in",
      purpose,
      host: host || STAFF[0].name,
      checkinTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "on-campus",
      date: "today",
    };
    setLoading(false);
    onSuccess(v);
    setName("");
    setPhone("");
    setNationalId("");
    toast.success("Quick check-in complete");
  };

  return (
    <div className="max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg mb-4">Quick Check-In</h3>
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Visitor Name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Phone (+250)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
            placeholder="+250 7XX XXX XXX"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as Visitor["purpose"])}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Host (staff / teacher)</label>
          <input
            value={hostQ || host}
            onChange={(e) => {
              setHostQ(e.target.value);
              setHost(e.target.value);
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
            placeholder="Search host..."
          />
          {hostQ && hosts.length > 0 && (
            <div className="mt-1 border border-border rounded-md bg-card shadow-sm max-h-32 overflow-y-auto">
              {hosts.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setHost(h.name);
                    setHostQ("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                >
                  {h.name} · {h.department}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">National ID (optional)</label>
          <input
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-md bg-primary text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Quick Check-In
        </button>
      </form>
    </div>
  );
}

function ScheduledTab({ list, onArrive }: { list: Visitor[]; onArrive: (id: string) => void }) {
  if (list.length === 0) {
    return <EmptyState icon={Calendar} message="No scheduled visitors for today." />;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Expected</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={v.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3 font-semibold">{v.name}</td>
              <td className="px-4 py-3">
                {v.appointmentDate} {v.appointmentTime}
              </td>
              <td className="px-4 py-3">{v.purpose}</td>
              <td className="px-4 py-3">{v.host}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onArrive(v.id)}
                  className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
                >
                  Arrive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({
  list,
  q,
  onQ,
}: {
  list: Visitor[];
  q: string;
  onQ: (s: string) => void;
}) {
  if (list.length === 0) {
    return (
      <>
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search history..."
            className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
          />
        </div>
        <EmptyState icon={Inbox} message="No visitor history matches your search." />
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search history..."
            className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
          />
        </div>
        <input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="From date" />
        <input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="To date" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">Read-only log — staff cannot delete visitor history.</p>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Visitor</th>
              <th className="px-4 py-3 text-left">Host</th>
              <th className="px-4 py-3 text-left">Check-in</th>
              <th className="px-4 py-3 text-left">Check-out</th>
              <th className="px-4 py-3 text-left">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v, i) => (
              <tr key={v.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3">{v.host}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkoutTime ?? "—"}</td>
                <td className="px-4 py-3">{v.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
