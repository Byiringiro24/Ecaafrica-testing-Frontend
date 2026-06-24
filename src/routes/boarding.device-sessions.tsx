import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/device-sessions")({
  component: DeviceSessionsPage,
});

type Device = { id: string; name: string; location?: string | null };
type Rule = { label?: string; start: string; end: string };
type Session = { name: string; rules: Rule[] };

type SessionFormState = {
  name: string;
  rules: Rule[];
};

const createEmptySession = (name = ""): SessionFormState => ({
  name,
  rules: [{ label: "Present", start: "07:00", end: "08:00" }],
});

const createMorningSession = (): SessionFormState => ({
  name: "Morning",
  rules: [
    { label: "Arrived on time", start: "07:00", end: "07:30" },
    { label: "Late arrival", start: "07:30", end: "08:30" },
  ],
});

const createEveningSession = (): SessionFormState => ({
  name: "Evening",
  rules: [
    { label: "Leave on time", start: "17:00", end: "17:15" },
    { label: "Leave late", start: "18:00", end: "18:30" },
    { label: "Stay at school", start: "19:00", end: "20:30" },
  ],
});

function DeviceSessionsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const deviceData = await apiRequest<any[]>("/devices?limit=200&sort=created_at&order=desc", { auth: "school" });
        const mappedDevices = (Array.isArray(deviceData) ? deviceData : []).map((device) => ({
          id: device.id,
          name: device.name,
          location: device.location,
        }));
        setDevices(mappedDevices);
        if (!selectedDeviceId && mappedDevices[0]) {
          setSelectedDeviceId(mappedDevices[0].id);
        }
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load devices");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedDeviceId) return;
      try {
        const payload = await apiRequest<{ sessions?: Session[] }>(`/devices/${selectedDeviceId}/attendance-config`, {
          auth: "school",
        });
        const nextSessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
        setSessions(nextSessions);
        setSelectedSessionIndex(nextSessions.length ? 0 : -1);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load session config");
      }
    };

    void loadConfig();
  }, [selectedDeviceId]);

  const selectedDeviceName = useMemo(() => devices.find((device) => device.id === selectedDeviceId)?.name ?? "selected device", [devices, selectedDeviceId]);
  const selectedSession = sessions[selectedSessionIndex] ?? null;

  const updateSessionName = (name: string) => {
    setSessions((prev) => prev.map((session, index) => (index === selectedSessionIndex ? { ...session, name } : session)));
  };

  const updateRule = (index: number, field: keyof Rule, value: string) => {
    setSessions((prev) =>
      prev.map((session, sessionIndex) =>
        sessionIndex === selectedSessionIndex
          ? {
              ...session,
              rules: session.rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [field]: value } : rule)),
            }
          : session
      )
    );
  };

  const addRule = () => {
    setSessions((prev) =>
      prev.map((session, sessionIndex) =>
        sessionIndex === selectedSessionIndex
          ? { ...session, rules: [...session.rules, { label: "Present", start: "08:00", end: "08:30" }] }
          : session
      )
    );
  };

  const addSession = (template?: SessionFormState) => {
    const nextSession = template ?? createEmptySession();
    const nextSessions = [...sessions, { name: nextSession.name, rules: nextSession.rules }];
    setSessions(nextSessions);
    setSelectedSessionIndex(nextSessions.length - 1);
  };

  const addMorningSession = () => addSession(createMorningSession());
  const addEveningSession = () => addSession(createEveningSession());

  const removeRule = (index: number) => {
    setSessions((prev) =>
      prev.map((session, sessionIndex) =>
        sessionIndex === selectedSessionIndex
          ? { ...session, rules: session.rules.filter((_, ruleIndex) => ruleIndex !== index) }
          : session
      )
    );
  };

  const saveConfig = async () => {
    if (!selectedDeviceId) return;

    const normalizedSessions = sessions
      .map((session) => ({
        name: session.name.trim(),
        rules: session.rules
          .filter((rule) => rule.start && rule.end)
          .map((rule) => ({ label: rule.label?.trim() || undefined, start: rule.start, end: rule.end })),
      }))
      .filter((session) => session.name && session.rules.length > 0);

    if (!normalizedSessions.length) {
      toast.error("Add at least one session with at least one time window");
      return;
    }

    setSaving(true);
    try {
      const response = await apiRequest<{ sessions?: Session[] }>(`/devices/${selectedDeviceId}/attendance-config`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ sessions: normalizedSessions }),
      });
      const nextSessions = Array.isArray(response?.sessions) ? response.sessions : normalizedSessions;
      setSessions(nextSessions);
      setSelectedSessionIndex(nextSessions.length ? 0 : -1);
      toast.success(`Saved ${nextSessions.length} session${nextSessions.length > 1 ? "s" : ""} for ${selectedDeviceName}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save session config");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Device Sessions" subtitle="Create customizable attendance sessions for each device">
      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Manage sessions</p>
              <p className="text-xs text-muted-foreground">Configure one or more attendance windows per device.</p>
            </div>
            <div className="rounded-full border border-border bg-background p-2">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Device</span>
              <select
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3"
                disabled={loading}
              >
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addMorningSession} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                Add Morning Session
              </button>
              <button type="button" onClick={addEveningSession} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                Add Evening Session
              </button>
            </div>

            {selectedSession ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session name</span>
                  <input
                    value={selectedSession.name}
                    onChange={(event) => updateSessionName(event.target.value)}
                    placeholder="Morning Boarding"
                    className="h-10 w-full rounded-lg border border-border bg-background px-3"
                  />
                </label>

                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Attendance windows</p>
                      <p className="text-xs text-muted-foreground">Create or edit status windows for this session.</p>
                    </div>
                    <button type="button" onClick={addRule} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
                      <Plus className="h-3.5 w-3.5" /> Add Window
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedSession.rules.map((rule, index) => (
                      <div key={`${selectedSession.name}-${rule.start}-${rule.end}-${index}`} className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Window {index + 1}</span>
                          <button type="button" onClick={() => removeRule(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
                          <label className="text-sm">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status label</span>
                            <input
                              value={rule.label ?? ""}
                              onChange={(event) => updateRule(index, "label", event.target.value)}
                              placeholder="Present"
                              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Start time</span>
                            <input
                              type="time"
                              value={rule.start}
                              onChange={(event) => updateRule(index, "start", event.target.value)}
                              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">End time</span>
                            <input
                              type="time"
                              value={rule.end}
                              onChange={(event) => updateRule(index, "end", event.target.value)}
                              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Add a morning or evening session to start customizing rules.
              </div>
            )}

            <button type="button" onClick={saveConfig} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Session"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Saved sessions</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">These rules are stored on the chosen device and are used to resolve present, late, or absent outcomes.</p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Loading sessions…</div>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No attendance sessions saved yet for {selectedDeviceName}.</div>
            ) : sessions.map((session, index) => (
              <button
                key={`${session.name}-${index}`}
                type="button"
                onClick={() => setSelectedSessionIndex(index)}
                className={`w-full rounded-lg border p-4 text-left transition ${selectedSessionIndex === index ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{session.name || `Session ${index + 1}`}</p>
                    <p className="text-xs text-muted-foreground">{session.rules.length} time window{session.rules.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.rules.map((rule, ruleIndex) => (
                    <span key={`${session.name}-${rule.start}-${rule.end}-${ruleIndex}`} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
                      {rule.label || "Window"}: {rule.start}–{rule.end}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
