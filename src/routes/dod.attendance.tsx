/**
 * DOD Boarding Attendance — configure windows, view sessions, trigger reconciliation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { boardingAttendanceApi, type BoardingWindow, type BoardingConfig } from "@/lib/boardingApi";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dod/attendance")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodAttendancePage,
});

type Dormitory = { id: string; name: string; block_name?: string | null };
const TABS = ["Attendance Windows", "Configuration"] as const;

function DodAttendancePage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Attendance Windows");
  const [windows, setWindows] = useState<BoardingWindow[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [config, setConfig] = useState<BoardingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<BoardingConfig>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [wins, dorms, cfg] = await Promise.all([
        boardingAttendanceApi.listWindows(),
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }),
        boardingAttendanceApi.getConfig(),
      ]);
      setWindows(Array.isArray(wins) ? wins : []);
      setDormitories(Array.isArray(dorms) ? dorms : []);
      setConfig(cfg);
      setConfigForm(cfg);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attendance config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this attendance window?")) return;
    try {
      await boardingAttendanceApi.deleteWindow(id);
      toast.success("Window removed");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove window");
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await boardingAttendanceApi.updateConfig(configForm);
      setConfig(updated);
      toast.success("Configuration saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save config");
    } finally {
      setSavingConfig(false);
    }
  };

  const dormName = (id?: string | null) => dormitories.find(d => d.id === id)?.name ?? "All Dormitories";

  return (
    <DodLayout title="Boarding Attendance" subtitle="Configure attendance windows and settings">
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Attendance Windows" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Define the daily boarding attendance window. Students must scan biometrics within this period to be marked Present.</p>
            <button onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Window
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : windows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No attendance windows configured yet. Add one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {windows.map(w => (
                <div key={w.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">{w.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {w.start_time} – {w.end_time}
                      {w.grace_minutes > 0 && ` · ${w.grace_minutes}min grace`}
                      {" · Escalation: "}{w.escalation_mins}min
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Dormitory: {dormName(w.dormitory_id)} · Days: {w.applicable_days}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${w.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                    <button onClick={() => void handleDelete(w.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Configuration" && (
        <div className="max-w-lg space-y-5">
          {loading ? <Skeleton className="h-80" /> : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-display font-bold">Leave & Exit Settings</h3>
                <ConfigRow label="Max short leave (hours)" value={configForm.max_short_leave_hours ?? 8}
                  onChange={v => setConfigForm(p => ({ ...p, max_short_leave_hours: Number(v) }))} />
                <ConfigRow label="Max long leave (days)" value={configForm.max_long_leave_days ?? 14}
                  onChange={v => setConfigForm(p => ({ ...p, max_long_leave_days: Number(v) }))} />
                <ConfigRow label="Late return threshold (mins)" value={configForm.late_return_threshold_mins ?? 15}
                  onChange={v => setConfigForm(p => ({ ...p, late_return_threshold_mins: Number(v) }))} />
                <ConfigRow label="Parent escalation delay (mins)" value={configForm.parent_escalation_mins ?? 60}
                  onChange={v => setConfigForm(p => ({ ...p, parent_escalation_mins: Number(v) }))} />
              </div>
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="font-display font-bold">Security Requirements</h3>
                {([
                  ["require_student_photo", "Require student photo before exit"],
                  ["require_biometric_return", "Require biometric return confirmation"],
                  ["require_gate_exit_confirm", "Require gate keeper to confirm exit"],
                ] as [keyof BoardingConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!configForm[key]}
                      onChange={e => setConfigForm(p => ({ ...p, [key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-border" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="font-display font-bold">SMS Notifications</h3>
                {([
                  ["sms_on_leave_approval", "SMS on leave approval"],
                  ["sms_on_long_leave", "SMS on long leave approval"],
                  ["sms_on_medical_leave", "SMS on medical leave approval"],
                  ["sms_on_missing_attendance", "SMS on missing attendance (after escalation)"],
                  ["sms_on_late_return", "SMS on late return"],
                ] as [keyof BoardingConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!configForm[key]}
                      onChange={e => setConfigForm(p => ({ ...p, [key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-border" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              <button onClick={handleSaveConfig} disabled={savingConfig}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                <Settings className="h-4 w-4" />
                {savingConfig ? "Saving…" : "Save Configuration"}
              </button>
            </>
          )}
        </div>
      )}

      {showNew && (
        <NewWindowModal
          dormitories={dormitories}
          onClose={() => setShowNew(false)}
          onCreate={async (payload) => {
            try {
              await boardingAttendanceApi.createWindow(payload);
              toast.success("Attendance window created");
              setShowNew(false);
              await load();
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to create window");
            }
          }}
        />
      )}
    </DodLayout>
  );
}

function ConfigRow({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} min={0}
        className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-right" />
    </div>
  );
}

function NewWindowModal({ dormitories, onClose, onCreate }: {
  dormitories: Dormitory[];
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("Evening Roll Call");
  const [dormitoryId, setDormitoryId] = useState("");
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("21:00");
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [escalationMins, setEscalationMins] = useState(60);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({ name, dormitory_id: dormitoryId || undefined, start_time: startTime, end_time: endTime, grace_minutes: graceMinutes, escalation_mins: escalationMins });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h2 className="font-display font-bold text-lg mb-4">New Attendance Window</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Window Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Dormitory (optional — leave blank for all)</label>
            <select value={dormitoryId} onChange={e => setDormitoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">All Dormitories</option>
              {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Grace Period (mins)</label>
              <input type="number" value={graceMinutes} onChange={e => setGraceMinutes(Number(e.target.value))} min={0}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Escalation Delay (mins)</label>
              <input type="number" value={escalationMins} onChange={e => setEscalationMins(Number(e.target.value))} min={0}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Creating…" : "Create Window"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
