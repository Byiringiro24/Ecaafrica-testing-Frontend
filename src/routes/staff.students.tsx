import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Phone, X, MessageSquare, Plus, Pencil, Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { STUDENTS as SEED, type Student } from "@/lib/mockData";
import { ROLL_STUDENTS, CLASSES } from "@/lib/teacherStaffData";

const BOARDER_IDS = new Set(ROLL_STUDENTS.map((s) => s.studentId));

export const Route = createFileRoute("/staff/students")({ component: StudentManagement });

type FormState = Omit<Student, "attendanceRate">;

const blankForm = (): FormState => ({
  id: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
  cardId: `CARD-${Math.floor(10000 + Math.random() * 90000)}`,
  name: "",
  gender: "Male",
  class: CLASSES[0],
  parentName: "",
  parentPhone: "+250 ",
});

function StudentManagement() {
  const [students, setStudents] = useState<Student[]>(() => SEED.slice());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Student | null>(null);

  const list = useMemo(() => students.filter(s => {
    if (q && !(s.name.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q) || s.class.toLowerCase().includes(q.toLowerCase()) || s.parentPhone.includes(q))) return false;
    if (filter !== "All" && filter !== "Boarders" && filter !== "Day Students" && !s.class.startsWith(filter)) return false;
    if (filter === "Boarders" && !BOARDER_IDS.has(s.id)) return false;
    if (filter === "Day Students" && BOARDER_IDS.has(s.id)) return false;
    return true;
  }), [q, filter, students]);

  const addStudent = (data: FormState) => {
    if (students.some(s => s.id === data.id)) { toast.error("Student ID already exists"); return; }
    setStudents(prev => [{ ...data, attendanceRate: 100 }, ...prev]);
    toast.success(`Added ${data.name}`);
    setAdding(false);
  };
  const updateStudent = (data: FormState) => {
    setStudents(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
    toast.success(`Updated ${data.name}`);
    setEditing(null);
    if (open?.id === data.id) setOpen({ ...open, ...data });
  };
  const deleteStudent = (s: Student) => {
    setStudents(prev => prev.filter(x => x.id !== s.id));
    toast.success(`Removed ${s.name}`);
    setConfirmDel(null);
    if (open?.id === s.id) setOpen(null);
  };

  return (
    <StaffLayout title="Student Management" subtitle="Search, add, edit, and remove students">
      <div className="rounded-xl border border-border bg-card p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, student ID, class or parent phone..." className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-3 text-sm" />
          </div>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 h-12 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow hover:opacity-90"><UserPlus className="h-4 w-4" /> Add Student</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {["All", "S1", "S2", "S3", "S4", "S5", "S6", "Boarders", "Day Students"].map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c}</button>
          ))}
          <div className="ml-auto text-xs text-muted-foreground self-center">{list.length} student{list.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map(s => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition group">
            <button onClick={() => setOpen(s)} className="w-full text-left">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.class}
                    {BOARDER_IDS.has(s.id) ? ` · ${ROLL_STUDENTS.find(r => r.studentId === s.id)?.dorm ?? "Boarder"}` : " · Day"}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">On Campus</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {s.parentPhone}</div>
            </button>
            <div className="mt-3 pt-3 border-t border-border flex gap-2">
              <button onClick={() => setEditing(s)} className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-md border border-border text-xs font-semibold hover:bg-muted"><Pencil className="h-3 w-3" /> Edit</button>
              <button onClick={() => setConfirmDel(s)} className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-md border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No students match your search</div>}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(null)} />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-background z-10 px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="font-display text-lg font-bold">{open.name}</div>
              <button onClick={() => setOpen(null)} className="rounded-md p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Student ID</div><div className="font-medium">{open.id}</div></div>
                <div><div className="text-xs text-muted-foreground">Class</div><div className="font-medium">{open.class}</div></div>
                <div><div className="text-xs text-muted-foreground">Card #</div><div className="font-medium">{open.cardId}</div></div>
                <div><div className="text-xs text-muted-foreground">Gender</div><div className="font-medium">{open.gender}</div></div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs uppercase text-muted-foreground mb-1">Parent</div>
                <div className="font-medium">{open.parentName}</div>
                <a href={`tel:${open.parentPhone}`} className="text-xs text-primary inline-flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {open.parentPhone}</a>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Today's Gate Log</div>
                <div className="text-sm">06:18 — Entry · 12:40 — Exit · 15:10 — Entry</div>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2"><MessageSquare className="h-4 w-4" /> Send SMS</button>
                <button onClick={() => { setEditing(open); }} className="h-10 px-3 rounded-md border border-border font-semibold text-sm inline-flex items-center gap-1"><Pencil className="h-4 w-4" /> Edit</button>
                <button onClick={() => setConfirmDel(open)} className="h-10 px-3 rounded-md border border-red-200 text-red-600 font-semibold text-sm inline-flex items-center gap-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </aside>
        </>
      )}

      {(adding || editing) && (
        <StudentForm
          initial={editing ?? blankForm()}
          mode={editing ? "edit" : "add"}
          onCancel={() => { setAdding(false); setEditing(null); }}
          onSave={editing ? updateStudent : addStudent}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600 mb-3"><Trash2 className="h-6 w-6" /></div>
            <h3 className="font-display text-lg font-bold mb-1">Delete student?</h3>
            <p className="text-sm text-muted-foreground mb-4">This will permanently remove <span className="font-semibold text-foreground">{confirmDel.name}</span> ({confirmDel.id}) from the directory.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button>
              <button onClick={() => deleteStudent(confirmDel)} className="h-9 px-4 rounded-md bg-red-600 text-white text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}

function StudentForm({ initial, mode, onCancel, onSave }: { initial: FormState; mode: "add" | "edit"; onCancel: () => void; onSave: (data: FormState) => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.parentName.trim()) { toast.error("Please complete required fields"); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold inline-flex items-center gap-2">
            {mode === "add" ? <><Plus className="h-5 w-5 text-primary" /> Add Student</> : <><Pencil className="h-5 w-5 text-primary" /> Edit Student</>}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Student ID"><input value={form.id} onChange={e => update("id", e.target.value)} disabled={mode === "edit"} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono disabled:opacity-60" /></Field>
            <Field label="Card #"><input value={form.cardId} onChange={e => update("cardId", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono" /></Field>
          </div>
          <Field label="Full Name *"><input required value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Uwimana Marie" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender"><select value={form.gender} onChange={e => update("gender", e.target.value as "Male" | "Female")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option>Male</option><option>Female</option></select></Field>
            <Field label="Class"><select value={form.class} onChange={e => update("class", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="Parent Name *"><input required value={form.parentName} onChange={e => update("parentName", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
          <Field label="Parent Phone"><input value={form.parentPhone} onChange={e => update("parentPhone", e.target.value)} placeholder="+250 7XX XXX XXX" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "add" ? "Add Student" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}
