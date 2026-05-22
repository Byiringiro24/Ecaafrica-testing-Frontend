import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus, Search, User, DoorOpen, Eye, Pencil, X, Trash2, Download, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import {
  CLASS_LIST, STUDENTS, TODAY_ATTENDANCE, levelBadgeClass, levelBorderClass,
  type ClassInfo,
} from "@/lib/mockData";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/classes")({ component: ClassesPage });

const DEFAULT_LEVELS = ["Senior 1", "Senior 2", "Senior 3", "Senior 4", "Senior 5", "Senior 6"];

function ClassesPage() {
  const [list, setList] = useState<ClassInfo[]>(CLASS_LIST);
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState<ClassInfo | null>(null);
  const [detail, setDetail] = useState<ClassInfo | null>(null);
  const [editing, setEditing] = useState<ClassInfo | null>(null);

  const filtered = list.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.teacher.toLowerCase().includes(search.toLowerCase())
  );

  const todayPresent = (clsName: string) =>
    TODAY_ATTENDANCE.filter(a => a.class === clsName && a.status === "Present").length;

  return (
    <AppLayout title="Class Management" subtitle={`${list.length} classes — Senior 1 to Senior 6`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class or teacher…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => setAddOpen(true)}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Class
        </button>
        <button onClick={() => setLevelOpen(true)}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted">
          <Plus className="h-4 w-4" /> Add Level
        </button>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => {
          const present = todayPresent(c.name);
          const pct = c.studentCount ? Math.round((present / c.studentCount) * 100) : 0;
          return (
            <div key={c.id} className={`rounded-xl border border-l-4 border-border bg-card p-5 shadow-sm hover:shadow-md transition ${levelBorderClass(c.level)}`}>
              <div className="flex items-start justify-between">
                <div className={`px-3 py-1.5 rounded-lg font-display font-bold text-lg ${levelBadgeClass(c.level)}`}>{c.name}</div>
                <span className="text-xs text-muted-foreground">{c.studentCount}/{c.capacity}</span>
              </div>
              <div className="mt-3">
                <div className="font-semibold">{c.level} — Section {c.section}</div>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground"><User className="h-3.5 w-3.5" />{c.teacher}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><DoorOpen className="h-3.5 w-3.5" />{c.room}</div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Today's attendance</span>
                  <span className="font-semibold">{present} Present ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setDetail(c)} className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                  <Eye className="h-3.5 w-3.5" /> View Details
                </button>
                <button onClick={() => setEditing(c)} className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-semibold hover:bg-primary/20">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => setImportOpen(c)} className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Import Students
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {addOpen && <ClassFormModal levels={levels} onClose={() => setAddOpen(false)} onSave={(c) => { setList(p => [...p, c]); toast.success(`${c.name} created`); }} />}
      {editing && <ClassFormModal levels={levels} cls={editing} onClose={() => setEditing(null)}
        onSave={(c) => { setList(p => p.map(x => x.id === c.id ? c : x)); toast.success("Saved"); }}
        onDelete={(id) => { setList(p => p.filter(x => x.id !== id)); toast.success("Class deleted"); }} />}
      {detail && <ClassDetailDrawer cls={detail} onClose={() => setDetail(null)} />}
      {importOpen && <ClassImportModal cls={importOpen} onClose={() => setImportOpen(null)} />}
      {levelOpen && (
        <LevelFormModal
          levels={levels}
          onClose={() => setLevelOpen(false)}
          onSave={(level) => { setLevels(p => [...p, level]); toast.success(`${level} added`); }}
        />
      )}
    </AppLayout>
  );
}

function ClassDetailDrawer({ cls, onClose }: { cls: ClassInfo; onClose: () => void }) {
  const [tab, setTab] = useState<"students" | "trend" | "reports">("students");
  const [q, setQ] = useState("");
  const students = STUDENTS.filter(s => s.class === cls.name);
  const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));

  const trend = Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    rate: 70 + ((i * 11 + cls.name.charCodeAt(1)) % 25),
  }));
  const best = trend.reduce((a, b) => a.rate > b.rate ? a : b);
  const worst = trend.reduce((a, b) => a.rate < b.rate ? a : b);
  const avg = Math.round(trend.reduce((s, x) => s + x.rate, 0) / trend.length);

  const sorted = [...students].sort((a, b) => a.attendanceRate - b.attendanceRate);
  const worst5 = sorted.slice(0, 5);
  const best5 = [...sorted].reverse().slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-card shadow-2xl flex flex-col h-screen">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="font-display font-bold text-lg">{cls.name} — {cls.level} Section {cls.section}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{cls.teacher} • {cls.room}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex border-b border-border px-2">
          {(["students","trend","reports"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "students" ? "Students" : t === "trend" ? "Attendance Trend" : "Reports"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "students" && (
            <>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search students…"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
              </div>
              <div className="space-y-2">
                {filtered.map(s => {
                  const today = TODAY_ATTENDANCE.find(a => a.studentId === s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40">
                      <Avatar name={s.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.id}</div>
                      </div>
                      {today && <StatusBadge status={today.status} />}
                      <span className="text-xs font-semibold ml-2">{s.attendanceRate}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === "trend" && (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="rate" stroke="#545f72" fill="#545f7233" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Mini label="Best Day" value={`${best.day} • ${best.rate}%`} />
                <Mini label="Worst Day" value={`${worst.day} • ${worst.rate}%`} />
                <Mini label="Average" value={`${avg}%`} />
              </div>
            </>
          )}
          {tab === "reports" && (
            <>
              <div className="rounded-lg border border-border p-4 mb-4">
                <h4 className="font-display font-bold mb-2 text-sm">Top 5 Most Absent</h4>
                {worst5.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{100 - s.attendanceRate} days</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-destructive/15 text-destructive">High Risk</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border p-4 mb-4">
                <h4 className="font-display font-bold mb-2 text-sm">Top 5 Best Attendance</h4>
                {best5.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{s.name}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-success/15 text-success">{s.attendanceRate}%</span>
                  </div>
                ))}
              </div>
              <button onClick={() => toast.success("CSV download started")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function ClassFormModal({ cls, levels, onClose, onSave, onDelete }: { cls?: ClassInfo; levels: string[]; onClose: () => void; onSave: (c: ClassInfo) => void; onDelete?: (id: string) => void; }) {
  const [level, setLevel] = useState(cls?.level || levels[0] || "Senior 1");
  const [section, setSection] = useState(cls?.section || "A");
  const [teacher, setTeacher] = useState(cls?.teacher || "");
  const [room, setRoom] = useState(cls?.room || "");
  const [capacity, setCapacity] = useState(cls?.capacity || 40);
  const [confirmDel, setConfirmDel] = useState(false);
  const levelOptions = levels.includes(level) ? levels : [level, ...levels];

  const save = () => {
    if (!teacher || !room) { toast.error("Teacher and room are required"); return; }
    const lvlNum = level.match(/\d/)?.[0] || "1";
    const next: ClassInfo = {
      id: cls?.id || `CLS-${Date.now()}`,
      name: `S${lvlNum}${section}`,
      level, section, teacher, room, capacity,
      studentCount: cls?.studentCount ?? 0,
    };
    onSave(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">{cls ? "Edit Class" : "Add New Class"}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <Field label="Level"><select value={level} onChange={e => setLevel(e.target.value)} className={inp}>{levelOptions.map(l => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Section"><input value={section} onChange={e => setSection(e.target.value.toUpperCase())} className={inp} /></Field>
          <Field label="Teacher" full><input value={teacher} onChange={e => setTeacher(e.target.value)} className={inp} placeholder="e.g. Mr. Habimana" /></Field>
          <Field label="Room"><input value={room} onChange={e => setRoom(e.target.value)} className={inp} /></Field>
          <Field label="Capacity"><input type="number" value={capacity} onChange={e => setCapacity(+e.target.value)} className={inp} /></Field>
        </div>
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-border">
          {cls && onDelete ? (
            <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-destructive text-sm font-semibold hover:underline">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
            <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{cls ? "Save Changes" : "Save"}</button>
          </div>
        </div>
      </div>
      {cls && onDelete && (
        <ConfirmModal open={confirmDel} title="Delete Class" message={`Are you sure you want to delete ${cls.name}? This cannot be undone.`}
          danger confirmLabel="Delete" onConfirm={() => { onDelete(cls.id); onClose(); }} onClose={() => setConfirmDel(false)} />
      )}
    </div>
  );
}

function ClassImportModal({ cls, onClose }: { cls: ClassInfo; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);

  const importFile = () => {
    if (!file) {
      toast.error("Select a file to import");
      return;
    }
    toast.success(`Import queued for ${cls.name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Import Students</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            Import students into <span className="font-semibold text-foreground">{cls.name}</span>.
          </div>
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Upload File</span>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inp}
            />
          </label>
          <a
            href="/students-import-template.csv"
            download="ecareafrica-students-template.csv"
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download Template
          </a>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={importFile} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Import</button>
        </div>
      </div>
    </div>
  );
}

function LevelFormModal({ levels, onClose, onSave }: { levels: string[]; onClose: () => void; onSave: (level: string) => void; }) {
  const [name, setName] = useState("");

  const save = () => {
    const next = name.trim();
    if (!next) {
      toast.error("Level name is required");
      return;
    }
    if (levels.some(l => l.toLowerCase() === next.toLowerCase())) {
      toast.error("Level already exists");
      return;
    }
    onSave(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Add New Level</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Level Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior 7" className={inp} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "col-span-2" : ""}`}><span className="text-xs font-semibold mb-1.5 block">{label}</span>{children}</label>;
}
