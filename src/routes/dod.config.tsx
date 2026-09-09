/**
 * DOD Boarding Configuration (spec §64)
 * - Attendance: start/end time, grace period, escalation period, applicable dorms/classes
 * - Dining: meal timings by dormitory / room / class
 * - Leave: leave types, max duration, medical rules, emergency rules
 * - Security: gate exit confirmation, photo requirement, biometric return, late return threshold
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Save, RefreshCw, Settings, Clock, Utensils, Shield, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { boardingAttendanceApi, type BoardingConfig } from "@/lib/boardingApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dod/config")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodConfigPage,
});

const TABS = ["Attendance", "Dining", "Leave", "Security"] as const;
type Tab = typeof TABS[number];

function DodConfigPage() {
  const [tab,    setTab]    = useState<Tab>("Attendance");
  const [config, setConfig] = useState<BoardingConfig | null>(null);
  const [form,   setForm]   = useState<Partial<BoardingConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const cfg = await boardingAttendanceApi.getConfig();
      setConfig(cfg);
      setForm(cfg);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load configuration");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await boardingAttendanceApi.updateConfig(form);
      setConfig(updated);
      setForm(updated);
      toast.success("Configuration saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  const field = (key: keyof BoardingConfig) => ({
    value: (form[key] ?? "") as any,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const boolField = (key: keyof BoardingConfig) => ({
    checked: Boolean(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.checked })),
  });

  if (loading) {
    return (
      <DodLayout title="Boarding Configuration" subtitle="Attendance, dining, leave and security settings">
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      </DodLayout>
    );
  }

  return (
    <DodLayout title="Boarding Configuration" subtitle="Attendance, dining, leave and security settings">
      {/* Tab bar */}
      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* ── ATTENDANCE ── */}
        {tab === "Attendance" && (
          <div className="space-y-5">
            <SectionHeader icon={Clock} title="Attendance Timing" desc="Configure boarding attendance windows (spec §29)" />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Default Start Time" type="time" {...field("default_attendance_start" as any)} />
              <Field label="Default End Time"   type="time" {...field("default_attendance_end" as any)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Grace Period (minutes)" type="number" min="0" max="60"
                {...field("grace_period_mins" as any)} placeholder="e.g. 15" />
              <Field label="Parent Escalation Delay (minutes)" type="number" min="0" max="180"
                {...field("escalation_mins" as any)} placeholder="e.g. 60 (1 hour per spec §33)" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Applicable Days</label>
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="mon,tue,wed,thu,fri,sat,sun"
                {...field("applicable_days" as any)} />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated day abbreviations</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
              <strong>Spec §33 — Parent Escalation:</strong> After the attendance window closes and a student is missing,
              Patron/DOD are notified immediately. Parents receive SMS only after the configured escalation delay (default: 60 min).
            </div>
          </div>
        )}

        {/* ── DINING ── */}
        {tab === "Dining" && (
          <div className="space-y-5">
            <SectionHeader icon={Utensils} title="Dining Configuration" desc="Meal timing defaults (spec §38)" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Breakfast Time" type="time" {...field("breakfast_time" as any)} />
              <Field label="Lunch Time"     type="time" {...field("lunch_time" as any)} />
              <Field label="Dinner Time"    type="time" {...field("dinner_time" as any)} />
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <strong>Spec §38:</strong> Dining timing can be set by dormitory, room, or class.
              Configure specific schedules in the Dining Management section.
              The times above are school-wide defaults.
            </div>
          </div>
        )}

        {/* ── LEAVE ── */}
        {tab === "Leave" && (
          <div className="space-y-5">
            <SectionHeader icon={CalendarDays} title="Leave Configuration" desc="Leave types and rules (spec §12)" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Short Leave Duration (hours)" type="number" min="1"
                {...field("max_short_leave_hours" as any)} placeholder="e.g. 8" />
              <Field label="Max Long Leave Duration (days)" type="number" min="1"
                {...field("max_long_leave_days" as any)} placeholder="e.g. 14" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Late Return Threshold (minutes after expected return)</label>
              <input type="number" min="0" max="120" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="e.g. 15"
                {...field("late_return_threshold_mins" as any)} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Medical Leave Rules (spec §12.3)</p>
              <BoolField label="Medical leave requires supporting document" {...boolField("medical_leave_requires_doc" as any)} />
              <BoolField label="Medical leave triggers immediate parent SMS (spec §14)" {...boolField("medical_leave_sms" as any)} />
              <BoolField label="Long leave triggers parent SMS (spec §13)" {...boolField("long_leave_sms" as any)} />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
              <strong>Note:</strong> SMS and notification rules are configured by ECA (platform admin). You can view but not change the SMS gateway settings.
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab === "Security" && (
          <div className="space-y-5">
            <SectionHeader icon={Shield} title="Security Rules" desc="Gate exit, photo and biometric requirements (spec §46)" />
            <div className="space-y-4">
              <BoolField label="Student photograph is mandatory for gate exit (spec §6, §16)" {...boolField("require_student_photo" as any)} />
              <BoolField label="Gate keeper must confirm physical exit before student is marked On Leave (spec §15)" {...boolField("require_gate_confirmation" as any)} />
              <BoolField label="Return must be recorded through biometric attendance (spec §21)" {...boolField("require_biometric_return" as any)} />
              <BoolField label="Patron/Matron must confirm return before leave closes (spec §21)" {...boolField("require_patron_return_confirm" as any)} />
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800">
              <strong>Spec §72 mandatory rules enforced by system regardless of settings:</strong>
              <ul className="mt-1.5 ml-3 list-disc space-y-0.5">
                <li>Gate Keeper cannot approve or create leave</li>
                <li>Patron/Matron cannot approve leave — DOD only</li>
                <li>Exit confirmation creates an immutable timestamped audit record</li>
                <li>All biometric raw transactions are permanently preserved</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Reset
          </button>
        </div>
      </form>
    </DodLayout>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-border">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" {...props} />
    </div>
  );
}

function BoolField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-border p-3 hover:bg-muted/30">
      <input type="checkbox" className="h-4 w-4 rounded" {...props} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
