import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScanLine, CheckCircle2, Search, Send, Camera, Fingerprint, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import {
  TODAY_ATTENDANCE, STUDENTS, CLASSES, todayCounts, type AttendanceRecord, type Status,
} from "@/lib/mockData";

type ScanMode = "card" | "face" | "fingerprint";

export const Route = createFileRoute("/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>(TODAY_ATTENDANCE);
  const [scanInput, setScanInput] = useState("");
  const [popup, setPopup] = useState<{ name: string; class: string; status: Status; time: string } | null>(null);
  const [classFilter, setClassFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<ScanMode>("card");
  const [bioState, setBioState] = useState<"idle" | "scanning" | "error">("idle");
  const PAGE_SIZE = 20;

  const counts = todayCounts();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const markPresent = (student: typeof STUDENTS[number]) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setRecords(prev => prev.map(r => r.studentId === student.id ? { ...r, status: "Present", timeIn: time } : r));
    toast.success(`${student.name} — ${student.class} — Marked Present`);
    setPopup({ name: student.name, class: student.class, status: "Present", time });
    setTimeout(() => setPopup(null), 2200);
  };

  const startBiometric = () => {
    setBioState("scanning");
    setTimeout(() => {
      const ok = Math.random() > 0.15;
      if (ok) {
        const stu = STUDENTS[Math.floor(Math.random() * STUDENTS.length)];
        setBioState("idle");
        markPresent(stu);
      } else {
        setBioState("error");
        toast.error(mode === "face" ? "Face not recognized — try again" : "Fingerprint not registered for any student");
      }
    }, 2000);
  };

  const handleScan = () => {
    const id = scanInput.trim();
    if (!id) return;
    const student = STUDENTS.find(s => s.cardId === id || s.id === id || s.name.toLowerCase().includes(id.toLowerCase()));
    if (!student) {
      toast.error(`No student found for "${id}"`);
      setScanInput("");
      return;
    }
    const existing = records.find(r => r.studentId === student.id);
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (existing && existing.status === "Present") {
      toast.warning(`${student.name} already marked Present`);
    } else {
      setRecords(prev => prev.map(r => r.studentId === student.id ? { ...r, status: "Present", timeIn: time } : r));
      toast.success(`${student.name} — ${student.class} — Marked Present`);
      setPopup({ name: student.name, class: student.class, status: "Present", time });
      setTimeout(() => setPopup(null), 2000);
    }
    setScanInput("");
  };

  const updateStatus = (id: string, status: Status) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status, timeIn: status === "Absent" ? "—" : r.timeIn } : r));
    toast.info(`Marked ${status}`);
  };

  const filtered = useMemo(() => records.filter(r =>
    (classFilter === "All" || r.class === classFilter) &&
    (statusFilter === "All" || r.status === statusFilter) &&
    (search === "" || r.studentName.toLowerCase().includes(search.toLowerCase()))
  ), [records, classFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout title="Live Attendance" subtitle="Scan student ID cards to mark attendance">
      {/* Mode selector */}
      <div className="rounded-xl border border-border bg-card p-2 shadow-sm flex flex-wrap gap-1 mb-4">
        {([
          ["card", "ID Card Scan", ScanLine],
          ["face", "Face Recognition", Camera],
          ["fingerprint", "Fingerprint", Fingerprint],
        ] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => { setMode(k); setBioState("idle"); }}
            className={`flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${
              mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}>
            <Icon className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      {/* Scan card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {mode === "card" && (
          <div className="flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary mb-3">
              <ScanLine className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold">Scan Student ID Card</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter or scan a card ID (e.g. RW20240001)</p>
            <div className="mt-5 w-full max-w-xl flex flex-col sm:flex-row gap-2">
              <input autoFocus value={scanInput} onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="Card ID, Student ID or name…"
                className="flex-1 h-12 rounded-lg border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={handleScan} className="h-12 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Mark Attendance
              </button>
            </div>
          </div>
        )}

        {mode === "face" && (
          <div className="flex flex-col items-center text-center">
            <div className="relative h-52 w-52 rounded-xl border-2 border-dashed border-border bg-slate-900 overflow-hidden">
              <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-indigo-400" />
              <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-indigo-400" />
              <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-indigo-400" />
              <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-indigo-400" />
              {bioState === "scanning" && <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400 shadow-[0_0_12px_2px] shadow-indigo-400 face-scan-line" />}
              {bioState === "error" ? <XCircle className="absolute inset-0 m-auto h-12 w-12 text-destructive" /> : <Camera className="absolute inset-0 m-auto h-12 w-12 text-slate-500" />}
            </div>
            <p className="mt-4 text-sm font-semibold">Position student's face in the frame</p>
            <p className="text-xs text-muted-foreground">Ensure good lighting for accurate recognition</p>
            <button onClick={startBiometric} disabled={bioState === "scanning"}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {bioState === "scanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {bioState === "scanning" ? "Scanning…" : "Start Camera"}
            </button>
            <style>{`@keyframes faceScan { 0% { top: 0; } 100% { top: 100%; } } .face-scan-line { animation: faceScan 1.6s linear infinite; }`}</style>
          </div>
        )}

        {mode === "fingerprint" && (
          <div className="flex flex-col items-center text-center">
            <div className="relative h-44 w-44 grid place-items-center">
              {bioState === "scanning" && (
                <>
                  <span className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
                  <span className="absolute inset-4 rounded-full border-4 border-primary/30 animate-pulse" />
                </>
              )}
              <Fingerprint className={`h-32 w-32 ${
                bioState === "scanning" ? "text-primary" :
                bioState === "error" ? "text-destructive" : "text-muted-foreground"
              }`} />
            </div>
            <p className="mt-4 text-sm font-semibold">
              {bioState === "idle" && "Place student's finger on the scanner"}
              {bioState === "scanning" && "Scanning fingerprint…"}
              {bioState === "error" && "Fingerprint not registered for any student"}
            </p>
            <button onClick={startBiometric} disabled={bioState === "scanning"}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {bioState === "scanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              {bioState === "scanning" ? "Scanning…" : "Scan"}
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input
          type="date"
          defaultValue={new Date().toISOString().slice(0,10)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Classes</option>
          {CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Statuses</option>
          <option>Present</option><option>Absent</option><option>Late</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          onClick={() => toast.success("Bulk SMS queued for absent students")}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Send className="h-4 w-4" /> SMS Absent Parents
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap gap-2 items-center justify-between">
          <h3 className="font-display font-bold">Today's Attendance — {today}</h3>
          <div className="text-xs text-muted-foreground space-x-3">
            <span>Total: <b className="text-foreground">{counts.total}</b></span>
            <span>Present: <b className="text-success">{counts.present}</b></span>
            <span>Absent: <b className="text-destructive">{counts.absent}</b></span>
            <span>Late: <b className="text-amber-600">{counts.late}</b></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Card ID</th>
                <th className="text-left px-5 py-3">Class</th>
                <th className="text-left px-5 py-3">Time In</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => {
                const stu = STUDENTS.find(s => s.id === r.studentId);
                return (
                  <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/40 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.studentName} size="sm" />
                        <span className="font-medium">{r.studentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{stu?.cardId}</td>
                    <td className="px-5 py-3">{r.class}</td>
                    <td className="px-5 py-3">{r.timeIn}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => updateStatus(r.id, "Late")} className="text-xs font-semibold text-amber-600 hover:underline">Mark Late</button>
                      <button onClick={() => updateStatus(r.id, "Absent")} className="text-xs font-semibold text-destructive hover:underline">Mark Absent</button>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No records match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Next</button>
          </div>
        </div>
      </div>

      {/* Scan success popup */}
      {popup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="rounded-2xl bg-card p-8 shadow-2xl text-center max-w-sm mx-4 animate-in zoom-in-95">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success mb-4">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <Avatar name={popup.name} size="lg" />
            <h3 className="font-display text-xl font-bold mt-3">{popup.name}</h3>
            <p className="text-sm text-muted-foreground">{popup.class} • {popup.time}</p>
            <div className="mt-3"><StatusBadge status={popup.status} /></div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
