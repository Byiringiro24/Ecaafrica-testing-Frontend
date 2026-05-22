import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Save, AlertTriangle, Loader2, Download, ClipboardList, History, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { StaffModal } from "@/components/staff/ui";
import { ROLL_CALL_DORMS, ROLL_STUDENTS, LEAVE_REQUESTS } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/staff/boarding")({ component: BoardingPage });

type RollStatus = "Present" | "Absent" | "On Leave";
const NEXT: Record<RollStatus, RollStatus> = { Present: "Absent", Absent: "On Leave", "On Leave": "Present" };
const C: Record<RollStatus, string> = {
  Present: "bg-primary/10 text-primary",
  Absent: "bg-destructive/10 text-destructive",
  "On Leave": "bg-muted text-muted-foreground",
};
const STORAGE_KEY = "staff-roll-draft";
const HISTORY_KEY = "staff-roll-history";

type HistoryRow = {
  id: string;
  date: string;
  session: string;
  dorm: string;
  studentId: string;
  name: string;
  class: string;
  status: RollStatus;
  by: string;
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  // Excel-friendly UTF-8 BOM
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadHistory(): HistoryRow[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  // Seed with a few demo rows so "view from device" isn't empty
  const today = new Date().toISOString().slice(0, 10);
  return ROLL_STUDENTS.slice(0, 12).map((s, i) => ({
    id: `${today}-evening-${s.studentId}`,
    date: today,
    session: "evening",
    dorm: s.dorm,
    studentId: s.studentId,
    name: s.name,
    class: s.class,
    status: i % 7 === 0 ? "Absent" : i % 5 === 0 ? "On Leave" : "Present",
    by: "Bizimana Alexis",
  }));
}

function BoardingPage() {
  const [tab, setTab] = useState<"roll" | "manual" | "history">("roll");
  const [session, setSession] = useState<"morning" | "evening">("evening");
  const [dorm, setDorm] = useState(ROLL_CALL_DORMS[0].name);
  const [marks, setMarks] = useState<Record<string, RollStatus>>({});
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [smsParents, setSmsParents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>(() => loadHistory());

  // Manual tab state
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mSession, setMSession] = useState<"morning" | "evening">("evening");
  const [mDorm, setMDorm] = useState(ROLL_CALL_DORMS[0].name);
  const [mMarks, setMMarks] = useState<Record<string, RollStatus>>({});
  const [mNote, setMNote] = useState("");

  // History tab filters
  const [hDate, setHDate] = useState("");
  const [hDorm, setHDorm] = useState("All");
  const [hStatus, setHStatus] = useState<"All" | RollStatus>("All");
  const [hSearch, setHSearch] = useState("");

  const onLeaveIds = useMemo(
    () => new Set(LEAVE_REQUESTS.filter((l) => l.status === "Approved").map((l) => l.studentId)),
    [],
  );
  const list = useMemo(() => ROLL_STUDENTS.filter((s) => s.dorm === dorm), [dorm]);
  const mList = useMemo(() => ROLL_STUDENTS.filter((s) => s.dorm === mDorm), [mDorm]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}-${dorm}-${session}`);
      if (raw) setMarks(JSON.parse(raw));
      else setMarks({});
    } catch {
      /* ignore */
    }
  }, [dorm, session]);

  useEffect(() => {
    const t = setInterval(() => {
      if (Object.keys(marks).length === 0) return;
      localStorage.setItem(`${STORAGE_KEY}-${dorm}-${session}`, JSON.stringify(marks));
      setDraftSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => clearInterval(t);
  }, [marks, dorm, session]);

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, "On Leave": 0 } as Record<RollStatus, number>;
    Object.values(marks).forEach((v) => c[v]++);
    return c;
  }, [marks]);

  const unexplainedAbsent = useMemo(
    () => list.filter((s) => marks[s.studentId] === "Absent" && !onLeaveIds.has(s.studentId)),
    [list, marks, onLeaveIds],
  );

  const persistHistory = (rows: HistoryRow[]) => {
    const next = [...rows, ...history];
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    const today = new Date().toISOString().slice(0, 10);
    const rows: HistoryRow[] = list.map((s) => ({
      id: `${today}-${session}-${s.studentId}`,
      date: today,
      session,
      dorm,
      studentId: s.studentId,
      name: s.name,
      class: s.class,
      status: marks[s.studentId] ?? (onLeaveIds.has(s.studentId) ? "On Leave" : "Present"),
      by: "Bizimana Alexis",
    }));
    persistHistory(rows);
    localStorage.removeItem(`${STORAGE_KEY}-${dorm}-${session}`);
    setSubmitting(false);
    setSubmitOpen(false);
    toast.success(`${session} roll call submitted for ${dorm}`);
    setMarks({});
    setDraftSaved(null);
  };

  const submitManual = () => {
    if (Object.keys(mMarks).length === 0) {
      toast.error("Mark at least one student first");
      return;
    }
    const rows: HistoryRow[] = mList.map((s) => ({
      id: `${mDate}-${mSession}-manual-${s.studentId}`,
      date: mDate,
      session: `${mSession} (manual)`,
      dorm: mDorm,
      studentId: s.studentId,
      name: s.name,
      class: s.class,
      status: mMarks[s.studentId] ?? "Present",
      by: "Bizimana Alexis (manual)",
    }));
    persistHistory(rows);
    toast.success(`Manual attendance saved · ${mDorm} · ${mDate}`);
    setMMarks({});
    setMNote("");
  };

  const filteredHistory = useMemo(() => {
    return history.filter(
      (h) =>
        (!hDate || h.date === hDate) &&
        (hDorm === "All" || h.dorm === hDorm) &&
        (hStatus === "All" || h.status === hStatus) &&
        (!hSearch || h.name.toLowerCase().includes(hSearch.toLowerCase()) || h.studentId.toLowerCase().includes(hSearch.toLowerCase())),
    );
  }, [history, hDate, hDorm, hStatus, hSearch]);

  const exportHistory = () => {
    downloadCsv(
      `boarding-attendance-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Session", "Dorm", "Student ID", "Name", "Class", "Status", "Recorded By"],
      filteredHistory.map((h) => [h.date, h.session, h.dorm, h.studentId, h.name, h.class, h.status, h.by]),
    );
    toast.success("Exported to Excel (CSV)");
  };

  const exportSummary = () => {
    const byDorm: Record<string, { Present: number; Absent: number; "On Leave": number }> = {};
    filteredHistory.forEach((h) => {
      byDorm[h.dorm] ??= { Present: 0, Absent: 0, "On Leave": 0 };
      byDorm[h.dorm][h.status]++;
    });
    downloadCsv(
      `boarding-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Dorm", "Present", "Absent", "On Leave", "Total"],
      Object.entries(byDorm).map(([d, c]) => [d, c.Present, c.Absent, c["On Leave"], c.Present + c.Absent + c["On Leave"]]),
    );
    toast.success("Summary report exported");
  };

  const sessionLabel = session === "morning" ? "Morning (06:00–06:30)" : "Evening (21:00–21:30)";

  const TabBtn = ({ id, icon: Icon, label }: any) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${
        tab === id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <StaffLayout title="Boarding Roll Call" subtitle={`${new Date().toLocaleDateString()} · ${sessionLabel}`}>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TabBtn id="roll" icon={ClipboardList} label="Roll Call" />
        <TabBtn id="manual" icon={PencilLine} label="Manual Attendance" />
        <TabBtn id="history" icon={History} label="View Attendance" />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={exportHistory}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border text-xs font-semibold"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <button
            type="button"
            onClick={exportSummary}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
          >
            <Download className="h-4 w-4" /> Summary Report
          </button>
        </div>
      </div>

      {tab === "roll" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={session}
              onChange={(e) => setSession(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="morning">Morning Roll</option>
              <option value="evening">Evening Roll</option>
            </select>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-700">
              In Progress
            </span>
            {draftSaved && <span className="text-xs text-muted-foreground">Draft saved {draftSaved}</span>}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {ROLL_CALL_DORMS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDorm(d.name)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  dorm === d.name ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          {unexplainedAbsent.length > 0 && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{unexplainedAbsent.length} student(s) absent with no approved leave. Send alerts?</span>
              </div>
              <button
                type="button"
                onClick={() => toast.success("Parent SMS alerts queued")}
                className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold"
              >
                Send Parent Alerts
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="p-3 border-b border-border flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const m: Record<string, RollStatus> = {};
                    list.forEach((s) => {
                      m[s.studentId] = onLeaveIds.has(s.studentId) ? "On Leave" : "Present";
                    });
                    setMarks((prev) => ({ ...prev, ...m }));
                  }}
                  className="h-8 px-3 text-xs font-semibold rounded-md bg-primary/10 text-primary"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Imported from yesterday's session")}
                  className="h-8 px-3 text-xs font-semibold rounded-md border border-border"
                >
                  Import from Yesterday
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase">
                  <tr>
                    <th className="text-left p-3">Bed</th>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Class</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const autoLeave = onLeaveIds.has(s.studentId);
                    const status = marks[s.studentId] ?? (autoLeave ? "On Leave" : undefined);
                    return (
                      <tr key={s.studentId} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                        <td className="p-3 font-mono">{s.bedNo}</td>
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3">{s.class}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            disabled={autoLeave}
                            onClick={() =>
                              setMarks({
                                ...marks,
                                [s.studentId]: status ? NEXT[status] : autoLeave ? "On Leave" : "Present",
                              })
                            }
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              status ? C[status] : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {status ?? (autoLeave ? "On Leave" : "Mark")}
                          </button>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{autoLeave ? "Approved leave" : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit space-y-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Dorm Summary</div>
                <div className="font-display text-lg font-bold">{dorm}</div>
                <div className="text-xs text-muted-foreground">{list.length} students</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-primary/5 p-2">
                  <div className="text-xl font-bold text-primary">{counts.Present}</div>
                  <div className="text-[10px] uppercase">Present</div>
                </div>
                <div className="rounded bg-destructive/5 p-2">
                  <div className="text-xl font-bold text-destructive">{counts.Absent}</div>
                  <div className="text-[10px] uppercase">Absent</div>
                </div>
                <div className="rounded bg-muted p-2">
                  <div className="text-xl font-bold text-muted-foreground">{counts["On Leave"]}</div>
                  <div className="text-[10px] uppercase">Leave</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Completion</span>
                  <span>
                    {Object.keys(marks).length}/{list.length}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (Object.keys(marks).length / Math.max(1, list.length)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={Object.keys(marks).length !== list.length}
                onClick={() => setSubmitOpen(true)}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" /> Submit Roll Call
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "manual" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1">Date</label>
              <input
                type="date"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Session</label>
              <select
                value={mSession}
                onChange={(e) => setMSession(e.target.value as any)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Dorm</label>
              <select
                value={mDorm}
                onChange={(e) => setMDorm(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLL_CALL_DORMS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                const m: Record<string, RollStatus> = {};
                mList.forEach((s) => (m[s.studentId] = "Present"));
                setMMarks(m);
              }}
              className="h-9 px-3 rounded-md bg-primary/10 text-primary text-xs font-semibold"
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={() => setMMarks({})}
              className="h-9 px-3 rounded-md border border-border text-xs font-semibold"
            >
              Clear
            </button>
            <input
              type="text"
              placeholder="Note (optional)"
              value={mNote}
              onChange={(e) => setMNote(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-[200px]"
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Bed</th>
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-left p-3">Mark</th>
                </tr>
              </thead>
              <tbody>
                {mList.map((s, i) => {
                  const cur = mMarks[s.studentId];
                  return (
                    <tr key={s.studentId} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                      <td className="p-3 font-mono">{s.bedNo}</td>
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3">{s.class}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {(["Present", "Absent", "On Leave"] as RollStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setMMarks({ ...mMarks, [s.studentId]: st })}
                              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                cur === st ? C[st] : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {st === "Present" ? "P" : st === "Absent" ? "A" : "L"}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-4 flex justify-between items-center rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-sm">
              Marked <b>{Object.keys(mMarks).length}</b>/{mList.length} ·{" "}
              <span className="text-primary font-semibold">
                {Object.values(mMarks).filter((s) => s === "Present").length}P
              </span>{" "}
              ·{" "}
              <span className="text-destructive font-semibold">
                {Object.values(mMarks).filter((s) => s === "Absent").length}A
              </span>{" "}
              ·{" "}
              <span className="text-muted-foreground font-semibold">
                {Object.values(mMarks).filter((s) => s === "On Leave").length}L
              </span>
            </div>
            <button
              type="button"
              onClick={submitManual}
              className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2"
            >
              <Save className="h-4 w-4" /> Save Attendance
            </button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1">Date</label>
              <input
                type="date"
                value={hDate}
                onChange={(e) => setHDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Dorm</label>
              <select
                value={hDorm}
                onChange={(e) => setHDorm(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>All</option>
                {ROLL_CALL_DORMS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Status</label>
              <select
                value={hStatus}
                onChange={(e) => setHStatus(e.target.value as any)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>All</option>
                <option>Present</option>
                <option>Absent</option>
                <option>On Leave</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Search name or ID"
              value={hSearch}
              onChange={(e) => setHSearch(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => {
                setHDate("");
                setHDorm("All");
                setHStatus("All");
                setHSearch("");
              }}
              className="h-9 px-3 rounded-md border border-border text-xs font-semibold"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(["Present", "Absent", "On Leave"] as RollStatus[]).map((s) => {
              const n = filteredHistory.filter((h) => h.status === s).length;
              return (
                <div key={s} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs uppercase text-muted-foreground">{s}</div>
                  <div className={`text-2xl font-bold ${s === "Present" ? "text-primary" : s === "Absent" ? "text-destructive" : "text-muted-foreground"}`}>
                    {n}
                  </div>
                </div>
              );
            })}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase text-muted-foreground">Records</div>
              <div className="text-2xl font-bold">{filteredHistory.length}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Session</th>
                  <th className="text-left p-3">Dorm</th>
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">By</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">
                      No records on this device. Submit roll call or manual attendance to populate.
                    </td>
                  </tr>
                )}
                {filteredHistory.map((h, i) => (
                  <tr key={h.id + i} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                    <td className="p-3">{h.date}</td>
                    <td className="p-3 capitalize">{h.session}</td>
                    <td className="p-3">{h.dorm}</td>
                    <td className="p-3 font-medium">{h.name}</td>
                    <td className="p-3">{h.class}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${C[h.status]}`}>{h.status}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{h.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StaffModal
        open={submitOpen}
        onClose={() => !submitting && setSubmitOpen(false)}
        title="Submit roll call"
        wide
        footer={
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Submit
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            <b>{session}</b> roll call for <b>{dorm}</b>
          </p>
          <p>
            Present: {counts.Present} · Absent: {counts.Absent} · On leave: {counts["On Leave"]}
          </p>
          {counts.Absent > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Absent students</div>
              <ul className="list-disc pl-5 space-y-1">
                {list
                  .filter((s) => marks[s.studentId] === "Absent")
                  .map((s) => (
                    <li key={s.studentId}>
                      {s.name} ({s.class})
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={smsParents} onChange={(e) => setSmsParents(e.target.checked)} />
            Send SMS to absent students&apos; parents
          </label>
        </div>
      </StaffModal>
    </StaffLayout>
  );
}
