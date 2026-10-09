import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Clock3, Plus, Save, Sparkles, Trash2, Edit2, X,
  MessageSquareText, Power, PowerOff, CheckCircle2,
  Calendar, ChevronDown, ChevronUp, Activity, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/boarding/device-sessions")({
  component: DeviceSessionsPage,
});

type Device = { id: string; name: string; location?: string | null };
type AttendanceWindow = { id?: string; label: string; start_time: string; end_time: string };
type NotificationTemplate = { id: string; name: string; trigger_type: string; body_en: string };
type Session = {
  id: string;
  name: string;
  windows: AttendanceWindow[];
  send_sms: boolean;
  auto_approve: boolean;
  is_active: boolean;
  activated_at: string | null;
  notification_template_id: string | null;
  notification_template?: Pick<NotificationTemplate, "name" | "trigger_type"> | null;
  created_at: string;
  updated_at: string;
};

type SessionFormState = {
  name: string;
  windows: AttendanceWindow[];
  send_sms: boolean;
  auto_approve: boolean;
  notification_template_id: string;
};

type SmsMapping = {
  id: string;
  source_type: string;
  event_type: string;
  scope_key: string;
  template_id: string | null;
  send_sms: boolean;
  template?: Pick<NotificationTemplate, "name" | "trigger_type" | "body_en"> | null;
};

const SMS_MAPPING_OPTIONS = [
  { source_type: "gate_device", event_type: "school_entry", label: "Gate device · School entry", description: "Biometric or gate scans when a learner enters." },
  { source_type: "gate_device", event_type: "school_exit", label: "Gate device · School exit", description: "Biometric or gate scans when a learner leaves." },
  { source_type: "classroom_manual", event_type: "class_entry", label: "Classroom manual · Present", description: "Teacher attendance marked as present." },
  { source_type: "classroom_manual", event_type: "class_late", label: "Classroom manual · Late", description: "Teacher attendance marked as late." },
  { source_type: "classroom_manual", event_type: "class_absent", label: "Classroom manual · Absent", description: "Teacher attendance marked as absent." },
  { source_type: "classroom_manual", event_type: "class_excused", label: "Classroom manual · Excused", description: "Teacher attendance marked as excused." },
  { source_type: "dormitory_manual", event_type: "dormitory_morning_present", label: "Dormitory manual · Morning present", description: "Morning dormitory roll call present." },
  { source_type: "dormitory_manual", event_type: "dormitory_morning_absent", label: "Dormitory manual · Morning absent", description: "Morning dormitory roll call absent." },
  { source_type: "dormitory_manual", event_type: "dormitory_morning_on_leave", label: "Dormitory manual · Morning on leave", description: "Morning dormitory roll call on leave." },
  { source_type: "dormitory_manual", event_type: "dormitory_evening_present", label: "Dormitory manual · Evening present", description: "Evening dormitory roll call present." },
  { source_type: "dormitory_manual", event_type: "dormitory_evening_absent", label: "Dormitory manual · Evening absent", description: "Evening dormitory roll call absent." },
  { source_type: "dormitory_manual", event_type: "dormitory_evening_on_leave", label: "Dormitory manual · Evening on leave", description: "Evening dormitory roll call on leave." }
] as const;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error
    ? String((error as any).message) : fallback;

const normalizeListResponse = (payload: unknown) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as any).data)) return (payload as any).data;
  return [] as any[];
};

const createEmptySession = (name = ""): SessionFormState => ({
  name, windows: [{ label: "Present", start_time: "07:00", end_time: "08:00" }],
  send_sms: true, auto_approve: true, notification_template_id: "",
});
const createMorningSession = (): SessionFormState => ({
  name: "Morning",
  windows: [
    { label: "Arrived on time", start_time: "07:00", end_time: "07:30" },
    { label: "Late arrival", start_time: "07:30", end_time: "08:30" },
  ],
  send_sms: true, auto_approve: true, notification_template_id: "",
});
const createAfternoonSession = (): SessionFormState => ({
  name: "Afternoon",
  windows: [
    { label: "Present", start_time: "12:00", end_time: "13:00" },
    { label: "Late", start_time: "13:00", end_time: "14:00" },
  ],
  send_sms: true, auto_approve: true, notification_template_id: "",
});
const createEveningSession = (): SessionFormState => ({
  name: "Evening",
  windows: [
    { label: "Leave on time", start_time: "17:00", end_time: "17:15" },
    { label: "Leave late", start_time: "18:00", end_time: "18:30" },
    { label: "Stay at school", start_time: "19:00", end_time: "20:30" },
  ],
  send_sms: true, auto_approve: true, notification_template_id: "",
});

function DeviceSessionsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<NotificationTemplate[]>([]);
  const [smsMappings, setSmsMappings] = useState<SmsMapping[]>([]);
  const [mappingSavingKey, setMappingSavingKey] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<SessionFormState>(createEmptySession());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [historyTab, setHistoryTab] = useState<"sessions" | "history">("sessions");
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Linked boarding attendance sessions — shows which roll calls were triggered by each device
  const [boardingSessions, setBoardingSessions] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<string[]>([]);
  const [schoolSections, setSchoolSections] = useState<string[]>([]);
  const [historySessionFilter, setHistorySessionFilter] = useState("all");
  const [historyClassFilter, setHistoryClassFilter] = useState("all");
  const [historySectionFilter, setHistorySectionFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [deviceData, templateData, classData, sectionData] = await Promise.all([
          apiRequest<Device[]>("/devices?limit=200", { auth: "school" }),
          apiRequest<NotificationTemplate[]>("/notifications/templates?scope=global&is_active=true&limit=100", { auth: "school" }),
          apiRequest<any[]>("/classes?limit=500", { auth: "school" }),
          apiRequest<any[]>("/sections?limit=500", { auth: "school" }),
        ]);
        const mapped = normalizeListResponse(deviceData).map(d => ({ id: d.id, name: d.name, location: d.location }));
        const classNames = normalizeListResponse(classData)
          .map((item: any) => item?.name ?? item?.class_name)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0);
        const sectionNames = normalizeListResponse(sectionData)
          .map((item: any) => item?.name ?? item?.section_name ?? item?.full_name)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0);

        setDevices(mapped);
        setSmsTemplates(normalizeListResponse(templateData));
        setSchoolClasses(Array.from(new Set(classNames)).sort((a, b) => a.localeCompare(b)));
        setSchoolSections(Array.from(new Set(sectionNames)).sort((a, b) => a.localeCompare(b)));
        if (mapped[0]) setSelectedDeviceId(c => c || mapped[0].id);
      } catch (e) { toast.error(getErrorMessage(e, "Failed to load devices")); }
      finally { setLoading(false); }
    };
    void load();
  }, []);

  const loadSessions = async (deviceId: string) => {
    if (!deviceId) return;
    try {
      const payload = await apiRequest<{ sessions?: Session[] }>(`/devices/${deviceId}/sessions`, { auth: "school" });
      setSessions(Array.isArray(payload?.sessions) ? payload.sessions : []);
    } catch (e) { toast.error(getErrorMessage(e, "Failed to load sessions")); }
  };

  useEffect(() => { void loadSessions(selectedDeviceId); }, [selectedDeviceId]);

  const loadHistory = async () => {
    if (!selectedDeviceId || !historyDate) return;
    setHistoryLoading(true);
    try {
      const start = `${historyDate}T00:00:00.000Z`;
      const end   = `${historyDate}T23:59:59.999Z`;
      const [logsData, boardingData] = await Promise.all([
        apiRequest<any>(
          `/attendance/records/device-logs?deviceId=${selectedDeviceId}&startDate=${start}&endDate=${end}&limit=200`,
          { auth: "school" }
        ).catch(() => null),
        // Load boarding attendance sessions for the same date — shows dormitory roll calls
        // triggered by this device's scans (linked via boarding_attendance_windows.window_id)
        apiRequest<any>(
          `/boarding/attendance/sessions?session_date=${historyDate}&limit=100`,
          { auth: "school" }
        ).catch(() => null),
      ]);
      const rows = Array.isArray(logsData?.data) ? logsData.data : Array.isArray(logsData) ? logsData : [];
      setHistoryLogs(rows);
      const boardingRows = Array.isArray(boardingData?.data) ? boardingData.data
        : Array.isArray(boardingData) ? boardingData : [];
      setBoardingSessions(boardingRows);
    } catch { setHistoryLogs([]); setBoardingSessions([]); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (historyTab === "history") void loadHistory();
  }, [historyTab, historyDate, selectedDeviceId]);

  const activeSession = useMemo(() => sessions.find(s => s.is_active), [sessions]);
  const selectedDeviceName = useMemo(() => devices.find(d => d.id === selectedDeviceId)?.name ?? "selected device", [devices, selectedDeviceId]);
  const selectedSmsTemplate = useMemo(() => smsTemplates.find(t => t.id === formData.notification_template_id) ?? null, [formData.notification_template_id, smsTemplates]);

  const historySessionOptions = useMemo(() => {
    const values = new Set<string>();
    sessions.forEach((session) => {
      const value = session.name?.trim();
      if (value) values.add(value);
    });
    historyLogs.forEach((log) => {
      const value = (log.attendance_period || log.session_name || "No Session").toString();
      values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [sessions, historyLogs]);

  const historyClassOptions = useMemo(() => {
    const values = new Set<string>();
    for (const value of schoolClasses) values.add(value);
    historyLogs.forEach((log) => {
      const value = (log.class_name || log.class || "Unknown class").toString();
      if (value.trim()) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [schoolClasses, historyLogs]);

  const historySectionOptions = useMemo(() => {
    const values = new Set<string>();
    for (const value of schoolSections) values.add(value);
    historyLogs.forEach((log) => {
      const value = (log.section || log.section_name || "No section").toString();
      if (value.trim()) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [schoolSections, historyLogs]);

  const filteredHistoryLogs = useMemo(() => {
    return historyLogs.filter((log) => {
      const sessionValue = (log.attendance_period || log.session_name || "No Session").toString();
      const classValue = (log.class_name || "Unknown class").toString();
      const sectionValue = (log.section || "No section").toString();
      const statusValue = String(log.status || "").toLowerCase();

      return (
        (historySessionFilter === "all" || sessionValue === historySessionFilter) &&
        (historyClassFilter === "all" || classValue === historyClassFilter) &&
        (historySectionFilter === "all" || sectionValue === historySectionFilter) &&
        (historyStatusFilter === "all" || statusValue === historyStatusFilter)
      );
    });
  }, [historyLogs, historySessionFilter, historyClassFilter, historySectionFilter, historyStatusFilter]);

  const openCreateModal = (template?: SessionFormState) => {
    setFormData(template ?? createEmptySession());
    setEditingSession(null); setIsCreating(true); setShowModal(true);
  };
  const openEditModal = (session: Session) => {
    setFormData({ name: session.name, windows: session.windows.map(w => ({ ...w })), send_sms: session.send_sms, auto_approve: session.auto_approve, notification_template_id: session.notification_template_id ?? "" });
    setEditingSession(session); setIsCreating(false); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingSession(null); setIsCreating(false); setFormData(createEmptySession()); };
  const updateFormName = (name: string) => setFormData(p => ({ ...p, name }));
  const updateWindow = (i: number, field: keyof AttendanceWindow, value: string) =>
    setFormData(p => ({ ...p, windows: p.windows.map((w, idx) => idx === i ? { ...w, [field]: value } : w) }));
  const addWindow = () => setFormData(p => ({ ...p, windows: [...p.windows, { label: "Present", start_time: "08:00", end_time: "08:30" }] }));
  const removeWindow = (i: number) => setFormData(p => ({ ...p, windows: p.windows.filter((_, idx) => idx !== i) }));

  const handleActivate = async (session: Session) => {
    if (session.is_active) {
      if (!confirm(`Stop session "${session.name}"? Scans will no longer be tagged to it.`)) return;
      setActivating(session.id);
      try {
        await apiRequest(`/devices/${selectedDeviceId}/sessions/${session.id}/deactivate`, { method: "PATCH", auth: "school" });
        toast.success(`Session "${session.name}" deactivated`);
        await loadSessions(selectedDeviceId);
      } catch (e) { toast.error(getErrorMessage(e, "Failed to deactivate")); }
      finally { setActivating(null); }
    } else {
      const msg = `Set "${session.name}" as the manual override for this device?\n\nThe device still resolves attendance automatically by the matching time window, so this does not turn off the other saved sessions.`;
      if (!confirm(msg)) return;
      setActivating(session.id);
      try {
        await apiRequest(`/devices/${selectedDeviceId}/sessions/${session.id}/activate`, { method: "PATCH", auth: "school" });
        toast.success(`"${session.name}" is marked as active. Time-window matching still decides the effective attendance session automatically.`);
        await loadSessions(selectedDeviceId);
      } catch (e) { toast.error(getErrorMessage(e, "Failed to activate")); }
      finally { setActivating(null); }
    }
  };

  const saveSession = async () => {
    if (!selectedDeviceId) return;
    const normalizedWindows = formData.windows.filter(w => w.start_time && w.end_time).map(w => ({ label: w.label?.trim() || "Window", start_time: w.start_time, end_time: w.end_time }));
    if (!formData.name.trim()) { toast.error("Session name is required"); return; }
    if (!normalizedWindows.length) { toast.error("Add at least one time window"); return; }
    if (formData.send_sms && !formData.notification_template_id) { toast.error("Choose an SMS template"); return; }
    const payload = { name: formData.name.trim(), windows: normalizedWindows, send_sms: formData.send_sms, auto_approve: formData.auto_approve, notification_template_id: formData.send_sms ? formData.notification_template_id : null };
    setSaving(true);
    try {
      if (editingSession) {
        await apiRequest<Session>(`/devices/${selectedDeviceId}/sessions/${editingSession.id}`, { method: "PUT", auth: "school", body: JSON.stringify(payload) });
        toast.success(`Updated "${formData.name}"`);
      } else {
        await apiRequest<Session>(`/devices/${selectedDeviceId}/sessions`, { method: "POST", auth: "school", body: JSON.stringify(payload) });
        toast.success(`Created "${formData.name}"`);
      }
      await loadSessions(selectedDeviceId);
      closeModal();
    } catch (e) { toast.error(getErrorMessage(e, "Failed to save session")); }
    finally { setSaving(false); }
  };

  const deleteSession = async (session: Session) => {
    if (!confirm(`Delete "${session.name}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/devices/${selectedDeviceId}/sessions/${session.id}`, { method: "DELETE", auth: "school" });
      toast.success(`Deleted "${session.name}"`);
      await loadSessions(selectedDeviceId);
    } catch (e) { toast.error(getErrorMessage(e, "Failed to delete")); }
  };

  return (
    <AppLayout title="Attendance Sessions" subtitle="Sessions resolve automatically from the active time windows; manual activation only acts as a quick override when needed.">
      <div className="space-y-5">

        {/* ── Device selector + active session banner ── */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Device</label>
            <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" disabled={loading}>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}{d.location ? ` (${d.location})` : ""}</option>)}
            </select>
          </div>

          {activeSession && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-800">Active session:</span>
              <span className="text-emerald-700">{activeSession.name}</span>
              {activeSession.activated_at && (
                <span className="text-xs text-emerald-600 ml-1">
                  since {new Date(activeSession.activated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 border-b border-border">
          {(["sessions", "history"] as const).map(t => (
            <button key={t} onClick={() => setHistoryTab(t)}
              className={cn("px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px",
                historyTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t === "sessions" ? "Sessions" : "Attendance History"}
            </button>
          ))}
        </div>

        {/* ════════════════ SESSIONS TAB ════════════════ */}
        {historyTab === "sessions" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            {/* Left — controls */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Sessions for {selectedDeviceName}</p>
                  <p className="text-xs text-muted-foreground">The matching session is selected automatically by the current time window.</p>
                </div>
                <div className="rounded-full border border-border bg-background p-2">
                  <Clock3 className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openCreateModal()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  <Plus className="h-3.5 w-3.5" /> New Session
                </button>
                <button onClick={() => openCreateModal(createMorningSession())} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  + Morning
                </button>
                <button onClick={() => openCreateModal(createAfternoonSession())} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  + Afternoon
                </button>
                <button onClick={() => openCreateModal(createEveningSession())} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  + Evening
                </button>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">How sessions work:</p>
                <p>1. Create sessions (Morning, Afternoon, etc.) with time windows.</p>
                <p>2. The device resolves the matching session automatically based on the current time.</p>
                <p>3. Manual activation remains available as a temporary override for testing or special control.</p>
                <p>4. Grace-period and late rules still apply within each configured window.</p>
              </div>
            </div>

            {/* Right — session list */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Saved Sessions</h3>
                {activeSession && <span className="ml-auto text-xs text-emerald-600 font-semibold flex items-center gap-1"><Activity className="h-3 w-3" /> auto-selected</span>}
              </div>
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="px-5 py-8 text-sm text-muted-foreground">Loading…</div>
                ) : sessions.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-muted-foreground">No sessions yet for {selectedDeviceName}. Create one above.</div>
                ) : sessions.map((session, idx) => (
                  <div key={session.id} className={cn("px-5 py-4 transition-colors", session.is_active && "bg-emerald-50/50")}>
                    <div className="flex items-start gap-3">
                      {/* Status indicator */}
                      <div className={cn("mt-0.5 h-3 w-3 rounded-full shrink-0 ring-2 transition-all",
                        session.is_active ? "bg-emerald-500 ring-emerald-200 animate-pulse" : "bg-muted ring-border")
                      } />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{session.name || `Session ${idx + 1}`}</p>
                          {session.is_active && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Active</span>
                          )}
                        </div>
                        {session.is_active && session.activated_at && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            Activated {new Date(session.activated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.windows.length} window{session.windows.length !== 1 ? "s" : ""} ·{" "}
                          {session.send_sms ? `SMS on` : "No SMS"} ·{" "}
                          {session.auto_approve ? "Auto-approved" : "Needs review"}
                        </p>
                        {/* Collapsible windows */}
                        <button onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          {expandedSession === session.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expandedSession === session.id ? "Hide" : "Show"} time windows
                        </button>
                        {expandedSession === session.id && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {session.windows.map((w, wi) => (
                              <span key={w.id ?? wi} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
                                {w.label}: {w.start_time}–{w.end_time}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => void handleActivate(session)} disabled={activating === session.id}
                          title={session.is_active ? "Deactivate this session" : "Activate this session"}
                          className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                            session.is_active
                              ? "border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "border border-border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary")}>
                          {activating === session.id
                            ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            : session.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                          {session.is_active ? "Stop" : "Activate"}
                        </button>
                        <button onClick={() => openEditModal(session)} title="Edit"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void deleteSession(session)} title="Delete"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ HISTORY TAB ════════════════ */}
        {historyTab === "history" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground">Date</label>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm" />
              </div>
              <button onClick={() => void loadHistory()} disabled={historyLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                {historyLoading ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                Load
              </button>
              <span className="text-xs text-muted-foreground">{filteredHistoryLogs.length} of {historyLogs.length} records for {new Date(historyDate + "T12:00:00").toLocaleDateString([], { dateStyle: "medium" })}</span>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Session</label>
                <select value={historySessionFilter} onChange={(e) => setHistorySessionFilter(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="all">All sessions</option>
                  {historySessionOptions.map((session) => <option key={session} value={session}>{session}</option>)}
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Class</label>
                <select value={historyClassFilter} onChange={(e) => setHistoryClassFilter(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="all">All classes</option>
                  {historyClassOptions.map((className) => <option key={className} value={className}>{className}</option>)}
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Section</label>
                <select value={historySectionFilter} onChange={(e) => setHistorySectionFilter(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="all">All sections</option>
                  {historySectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
                <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="all">All statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="grace">Grace period</option>
                  <option value="absent">Absent</option>
                  <option value="not_scheduled">Not scheduled</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistorySessionFilter("all");
                  setHistoryClassFilter("all");
                  setHistorySectionFilter("all");
                  setHistoryStatusFilter("all");
                }}
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted"
              >
                Clear filters
              </button>
            </div>

            {/* Group by session */}
            {(() => {
              const grouped: Record<string, any[]> = {};
              for (const log of filteredHistoryLogs) {
                const key = log.attendance_period || log.session_name || "No Session";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(log);
              }
              const entries = Object.entries(grouped);
              if (historyLoading) return <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">Loading…</div>;
              if (!entries.length) return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No attendance records match the selected filters.</div>;
              return (
                <div className="space-y-4">
                  {entries.map(([sessionName, logs]) => (
                    <div key={sessionName} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="border-b border-border px-5 py-3 flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">{sessionName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{logs.length} scan{logs.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/20">
                              {["Student", "Class", "Method", "Direction", "Status", "Time"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {logs.map((log, i) => (
                              <tr key={log.id ?? i} className="hover:bg-muted/20">
                                <td className="px-4 py-2.5">
                                  <div className="font-medium">{log.student_name || "—"}</div>
                                  <div className="text-xs text-muted-foreground">{log.student_id || ""}</div>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.class_name || "—"}{log.section ? ` / ${log.section}` : ""}</td>
                                <td className="px-4 py-2.5 capitalize text-xs">{log.authentication_method || "—"}</td>
                                <td className="px-4 py-2.5">
                                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                                    log.direction === "entry" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                    {log.direction === "entry" ? "In" : "Out"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                                    log.status === "present" ? "bg-emerald-100 text-emerald-700"
                                    : log.status === "late" ? "bg-amber-100 text-amber-700"
                                    : "bg-muted text-muted-foreground")}>
                                    {log.status || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

            {/* Dormitory Roll Calls triggered by this device - linked via boarding_attendance_windows */}
            {boardingSessions.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
                <div className="border-b border-border px-5 py-3 flex items-center gap-2 bg-muted/30">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Dormitory Roll Calls — {historyDate}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{boardingSessions.length} session{boardingSessions.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-border">
                  {boardingSessions.map((bs: any) => (
                    <div key={bs.id} className="px-5 py-3 flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{bs.session_name || "Roll Call"}</div>
                        <div className="text-xs text-muted-foreground">
                          {bs.dormitory?.name ?? "All dormitories"} · {bs.session_date ? new Date(bs.session_date).toLocaleDateString([], { dateStyle: "medium" }) : "—"}
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-center">
                        <div><div className="font-bold text-emerald-600">{bs.total_present ?? 0}</div><div className="text-muted-foreground">Present</div></div>
                        <div><div className="font-bold text-amber-600">{bs.total_late ?? 0}</div><div className="text-muted-foreground">Late</div></div>
                        <div><div className="font-bold text-blue-600">{bs.total_on_leave ?? 0}</div><div className="text-muted-foreground">On Leave</div></div>
                        <div><div className="font-bold text-destructive">{bs.total_missing ?? 0}</div><div className="text-muted-foreground">Missing</div></div>
                        <div><div className="font-bold text-muted-foreground">{bs.total_expected ?? 0}</div><div className="text-muted-foreground">Expected</div></div>
                      </div>
                      {bs.reconciled_at && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold">Reconciled</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
      {/* ════════════════ CREATE / EDIT MODAL ════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-lg font-semibold">{isCreating ? "Create Session" : `Edit "${editingSession?.name}"`}</h2>
              <button onClick={closeModal} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session name</span>
                <input value={formData.name} onChange={e => updateFormName(e.target.value)} placeholder="Morning / Afternoon / Evening…"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3" />
              </label>
              <div className="space-y-3 border-y border-border py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                    <div><p className="text-sm font-semibold">Auto approve attendance</p><p className="text-xs text-muted-foreground">Accept matched scans immediately without manual review.</p></div>
                  </div>
                  <input type="checkbox" checked={formData.auto_approve} onChange={e => setFormData(c => ({ ...c, auto_approve: e.target.checked }))} className="h-4 w-4 accent-primary" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <MessageSquareText className="mt-0.5 h-4 w-4 text-primary" />
                    <div><p className="text-sm font-semibold">Parent attendance SMS</p><p className="text-xs text-muted-foreground">Send SMS to parents when a student scans during this session.</p></div>
                  </div>
                  <input type="checkbox" checked={formData.send_sms} onChange={e => setFormData(c => ({ ...c, send_sms: e.target.checked }))} className="h-4 w-4 accent-primary" />
                </div>
                {formData.send_sms && (
                  <div className="pl-7 space-y-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SMS template</span>
                      <select value={formData.notification_template_id} onChange={e => setFormData(c => ({ ...c, notification_template_id: e.target.value }))}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3">
                        <option value="">Choose an SMS</option>
                        {smsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </label>
                    {selectedSmsTemplate && (
                      <div className="border-l-2 border-primary bg-muted/50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{selectedSmsTemplate.body_en}</p>
                      </div>
                    )}
                    {!smsTemplates.length && <p className="text-xs text-destructive">No SMS templates available. Ask super admin to create one.</p>}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-dashed border-border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div><p className="text-sm font-semibold">Attendance windows</p><p className="text-xs text-muted-foreground">Each window defines a status label and the time range it covers.</p></div>
                  <button onClick={addWindow} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                    <Plus className="h-3.5 w-3.5" /> Add Window
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.windows.map((w, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Window {i + 1}</span>
                        <button onClick={() => removeWindow(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status label</span>
                          <input value={w.label ?? ""} onChange={e => updateWindow(i, "label", e.target.value)} placeholder="Present / Late…"
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Start time</span>
                          <input type="time" value={w.start_time} onChange={e => updateWindow(i, "start_time", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">End time</span>
                          <input type="time" value={w.end_time} onChange={e => updateWindow(i, "end_time", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card p-4">
              <button onClick={closeModal} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
              <button onClick={saveSession} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? "Saving…" : isCreating ? "Create Session" : "Update Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
