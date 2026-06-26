import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Plus, Save, Sparkles, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/device-sessions")({
  component: DeviceSessionsPage,
});

type Device = { id: string; name: string; location?: string | null };
type AttendanceWindow = { id?: string; label: string; start_time: string; end_time: string };
type Session = { 
  id: string; 
  name: string; 
  windows: AttendanceWindow[];
  created_at?: string;
  updated_at?: string;
};

type SessionFormState = {
  name: string;
  windows: AttendanceWindow[];
};

const createEmptySession = (name = ""): SessionFormState => ({
  name,
  windows: [{ label: "Present", start_time: "07:00", end_time: "08:00" }],
});

const createMorningSession = (): SessionFormState => ({
  name: "Morning",
  windows: [
    { label: "Arrived on time", start_time: "07:00", end_time: "07:30" },
    { label: "Late arrival", start_time: "07:30", end_time: "08:30" },
  ],
});

const createEveningSession = (): SessionFormState => ({
  name: "Evening",
  windows: [
    { label: "Leave on time", start_time: "17:00", end_time: "17:15" },
    { label: "Leave late", start_time: "18:00", end_time: "18:30" },
    { label: "Stay at school", start_time: "19:00", end_time: "20:30" },
  ],
});

function DeviceSessionsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<SessionFormState>(createEmptySession());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    const loadSessions = async () => {
      if (!selectedDeviceId) return;
      try {
        const payload = await apiRequest<{ sessions?: Session[] }>(`/devices/${selectedDeviceId}/sessions`, {
          auth: "school",
        });
        const nextSessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
        setSessions(nextSessions);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load sessions");
      }
    };

    void loadSessions();
  }, [selectedDeviceId]);

  const selectedDeviceName = useMemo(() => devices.find((device) => device.id === selectedDeviceId)?.name ?? "selected device", [devices, selectedDeviceId]);

  const openCreateModal = (template?: SessionFormState) => {
    setFormData(template ?? createEmptySession());
    setEditingSession(null);
    setIsCreating(true);
    setShowModal(true);
  };

  const openEditModal = (session: Session) => {
    setFormData({
      name: session.name,
      windows: session.windows.map(w => ({ ...w }))
    });
    setEditingSession(session);
    setIsCreating(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSession(null);
    setIsCreating(false);
    setFormData(createEmptySession());
  };

  const updateFormName = (name: string) => {
    setFormData((prev) => ({ ...prev, name }));
  };

  const updateWindow = (index: number, field: keyof AttendanceWindow, value: string) => {
    setFormData((prev) => ({
      ...prev,
      windows: prev.windows.map((window, windowIndex) =>
        windowIndex === index ? { ...window, [field]: value } : window
      ),
    }));
  };

  const addWindow = () => {
    setFormData((prev) => ({
      ...prev,
      windows: [...prev.windows, { label: "Present", start_time: "08:00", end_time: "08:30" }],
    }));
  };

  const removeWindow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      windows: prev.windows.filter((_, windowIndex) => windowIndex !== index),
    }));
  };

  const saveSession = async () => {
    if (!selectedDeviceId) return;

    const normalizedWindows = formData.windows
      .filter((window) => window.start_time && window.end_time)
      .map((window) => ({ 
        label: window.label?.trim() || "Window", 
        start_time: window.start_time, 
        end_time: window.end_time 
      }));

    if (!formData.name.trim()) {
      toast.error("Session name is required");
      return;
    }

    if (!normalizedWindows.length) {
      toast.error("Add at least one time window");
      return;
    }

    setSaving(true);
    try {
      if (editingSession) {
        // Update existing session
        await apiRequest<Session>(`/devices/${selectedDeviceId}/sessions/${editingSession.id}`, {
          method: "PUT",
          auth: "school",
          body: JSON.stringify({ name: formData.name.trim(), windows: normalizedWindows }),
        });
        toast.success(`Updated session "${formData.name}"`);
      } else {
        // Create new session
        await apiRequest<Session>(`/devices/${selectedDeviceId}/sessions`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ name: formData.name.trim(), windows: normalizedWindows }),
        });
        toast.success(`Created session "${formData.name}"`);
      }

      // Reload sessions
      const payload = await apiRequest<{ sessions?: Session[] }>(`/devices/${selectedDeviceId}/sessions`, {
        auth: "school",
      });
      setSessions(Array.isArray(payload?.sessions) ? payload.sessions : []);
      closeModal();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save session");
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (session: Session) => {
    if (!selectedDeviceId) return;
    
    if (!confirm(`Are you sure you want to delete "${session.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiRequest(`/devices/${selectedDeviceId}/sessions/${session.id}`, {
        method: "DELETE",
        auth: "school",
      });
      toast.success(`Deleted session "${session.name}"`);

      // Reload sessions
      const payload = await apiRequest<{ sessions?: Session[] }>(`/devices/${selectedDeviceId}/sessions`, {
        auth: "school",
      });
      setSessions(Array.isArray(payload?.sessions) ? payload.sessions : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete session");
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

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openCreateModal()} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted inline-flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" /> New Session
                </button>
                <button type="button" onClick={() => openCreateModal(createMorningSession())} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  Add Morning Session
                </button>
                <button type="button" onClick={() => openCreateModal(createEveningSession())} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  Add Evening Session
                </button>
              </div>
            </div>
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
            ) : (
              sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="w-full rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{session.name || `Session ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground">{session.windows.length} time window{session.windows.length > 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(session)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit session"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteSession(session)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.windows.map((window, windowIndex) => (
                      <span key={window.id ?? `window-${windowIndex}`} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
                        {window.label || "Window"}: {window.start_time}–{window.end_time}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal for Create/Edit Session */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-lg font-semibold">
                {isCreating ? "Create Session" : `Edit "${editingSession?.name}"`}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session name</span>
                <input
                  value={formData.name}
                  onChange={(event) => updateFormName(event.target.value)}
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
                  <button
                    type="button"
                    onClick={addWindow}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Window
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.windows.map((window, index) => (
                    <div key={`window-${index}`} className="rounded-lg border border-border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Window {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeWindow(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status label</span>
                          <input
                            value={window.label ?? ""}
                            onChange={(event) => updateWindow(index, "label", event.target.value)}
                            placeholder="Present"
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Start time</span>
                          <input
                            type="time"
                            value={window.start_time}
                            onChange={(event) => updateWindow(index, "start_time", event.target.value)}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">End time</span>
                          <input
                            type="time"
                            value={window.end_time}
                            onChange={(event) => updateWindow(index, "end_time", event.target.value)}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card p-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSession}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                disabled={saving}
              >
                <Save className="h-4 w-4" /> {saving ? "Saving..." : isCreating ? "Create Session" : "Update Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
