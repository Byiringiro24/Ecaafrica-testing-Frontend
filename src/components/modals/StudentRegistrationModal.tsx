import { useState } from "react";
import { X, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { CLASSES } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  name: string; residency: string; dob: string; gender: string;
  class: string; combination: string; year: string;
  parentName: string; relationship: string; parentPhone: string;
  parentPhone2: string; email: string; address: string;
  parentOccupation: string; parentNationalId: string;
}

const EMPTY: FormData = {
  name: "", residency: "Day", dob: "", gender: "Male",
  class: "S1A", combination: "", year: "2025",
  parentName: "", relationship: "Father", parentPhone: "",
  parentPhone2: "", email: "", address: "",
  parentOccupation: "", parentNationalId: "",
};

const STEPS = ["Student Info", "Parent Info", "Review"];

export function StudentRegistrationModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, boolean>>>({});

  if (!open) return null;

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setData(p => ({ ...p, [k]: v }));

  const validateStep = () => {
    const e: typeof errors = {};
    if (step === 0) {
      if (!data.name) e.name = true;
      if (!data.residency) e.residency = true;
      if (!data.dob) e.dob = true;
    }
    if (step === 1) {
      if (!data.parentName) e.parentName = true;
      if (!data.parentPhone) e.parentPhone = true;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(2, s + 1)); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const submit = () => {
    toast.success(`${data.name} registered successfully`);
    setData(EMPTY); setStep(0); onClose();
  };

  const close = () => { setData(EMPTY); setStep(0); setErrors({}); onClose(); };

  const showCombination = ["S4","S5","S6"].some(l => data.class.startsWith(l));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Register New Student</h2>
          <button onClick={close} className="rounded-md p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* steps indicator */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-xs font-bold shrink-0",
                  i < step ? "bg-success text-success-foreground" :
                  i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</div>
                </div>
                {i < STEPS.length - 1 && <div className={cn("h-0.5 flex-1", i < step ? "bg-success" : "bg-border")} />}
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *" error={errors.name}>
                <input value={data.name} onChange={e => set("name", e.target.value)} className={inputCls(errors.name)} placeholder="e.g. Uwimana Marie" />
              </Field>
              <Field label="Boarding / Day Student *" error={errors.residency}>
                <select value={data.residency} onChange={e => set("residency", e.target.value)} className={inputCls(errors.residency)}>
                  <option value="Day">Day Student</option>
                  <option value="Boarding">Boarding Student</option>
                </select>
              </Field>
              <Field label="Date of Birth *" error={errors.dob}>
                <input type="date" value={data.dob} onChange={e => set("dob", e.target.value)} className={inputCls(errors.dob)} />
              </Field>
              <Field label="Gender">
                <div className="flex gap-3 h-10 items-center">
                  {["Male","Female"].map(g => (
                    <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={data.gender === g} onChange={() => set("gender", g)} className="accent-primary" />
                      {g}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Class">
                <select value={data.class} onChange={e => set("class", e.target.value)} className={inputCls()}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              {showCombination && (
                <Field label="Combination">
                  <select value={data.combination} onChange={e => set("combination", e.target.value)} className={inputCls()}>
                    <option value="">Select…</option>
                    {["PCM","PCB","MCB","HEG","MEG","MPC","HGL"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Year of Enrollment">
                <select value={data.year} onChange={e => set("year", e.target.value)} className={inputCls()}>
                  {["2023","2024","2025","2026"].map(y => <option key={y}>{y}</option>)}
                </select>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Parent Full Name *" error={errors.parentName}>
                <input value={data.parentName} onChange={e => set("parentName", e.target.value)} className={inputCls(errors.parentName)} placeholder="e.g. Habimana Jean" />
              </Field>
              <Field label="Relationship">
                <select value={data.relationship} onChange={e => set("relationship", e.target.value)} className={inputCls()}>
                  {["Father","Mother","Guardian"].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Occupation">
                <input value={data.parentOccupation} onChange={e => set("parentOccupation", e.target.value)} className={inputCls()} placeholder="e.g. Nurse" />
              </Field>
              <Field label="National ID">
                <input value={data.parentNationalId} onChange={e => set("parentNationalId", e.target.value)} className={inputCls()} placeholder="1199…" />
              </Field>
              <Field label="Primary Phone (SMS) *" error={errors.parentPhone}>
                <input value={data.parentPhone} onChange={e => set("parentPhone", e.target.value)} className={inputCls(errors.parentPhone)} placeholder="+250 78X XXX XXX" />
              </Field>
              <Field label="Secondary Phone">
                <input value={data.parentPhone2} onChange={e => set("parentPhone2", e.target.value)} className={inputCls()} placeholder="Optional" />
              </Field>
              <Field label="Email">
                <input type="email" value={data.email} onChange={e => set("email", e.target.value)} className={inputCls()} placeholder="parent@example.com" />
              </Field>
              <Field label="Home Address / District">
                <input value={data.address} onChange={e => set("address", e.target.value)} className={inputCls()} placeholder="e.g. Kicukiro, Kigali" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ReviewBlock title="Student Information" rows={[
                ["Full Name", data.name],
                ["Residency", data.residency],
                ["Date of Birth", data.dob],
                ["Gender", data.gender],
                ["Class", data.class],
                ...(showCombination ? [["Combination", data.combination || "—"] as [string, string]] : []),
                ["Year of Enrollment", data.year],
              ]} />
              <ReviewBlock title="Parent / Guardian" rows={[
                ["Name", data.parentName],
                ["Relationship", data.relationship],
                ["Occupation", data.parentOccupation || "—"],
                ["National ID", data.parentNationalId || "—"],
                ["Primary Phone", data.parentPhone],
                ["Secondary Phone", data.parentPhone2 || "—"],
                ["Email", data.email || "—"],
                ["Address", data.address || "—"],
              ]} />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={step === 0 ? close : back}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-success-foreground hover:opacity-90">
              <Check className="h-4 w-4" /> Register Student
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function inputCls(error?: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
    error ? "border-destructive" : "border-border"
  );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={cn("text-xs font-semibold mb-1.5 block", error ? "text-destructive" : "text-foreground")}>{label}</span>
      {children}
    </label>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="font-display font-bold text-sm mb-3">{title}</h4>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
