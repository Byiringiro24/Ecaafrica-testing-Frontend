import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageSquareText, Save, ToggleLeft, ToggleRight, DoorOpen, BookOpen, Home, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/messages")({ component: AttendanceMessagesPage });

type Template = { id: string; name: string; trigger_type: string; body_en: string; is_active: boolean };
type Mapping  = { source_type: string; event_type: string; template_id: string | null; send_sms: boolean; template?: { name: string; body_en: string } | null };

// ── Event catalogue ──────────────────────────────────────────────────────────
const GROUPS = [
  {
    key: "gate",
    label: "Gate attendance",
    icon: "gate",
    description: "SMS sent automatically when a student passes through the school gate device.",
    options: [
      { source: "gate_device", event: "school_entry", label: "Student ENTERS school", description: "Fires when a student scans in at the main gate — student arriving.", badge: "entry" },
      { source: "gate_device", event: "school_exit",  label: "Student LEAVES school", description: "Fires when a student scans out at the main gate — student departing.", badge: "exit" },
      { source: "gate_device", event: "device_late",  label: "Device — late scan",   description: "Student scanned after the configured attendance window closed.", badge: "late" },
      { source: "gate_device", event: "device_absent",label: "Device — no scan",     description: "Student not recorded during the configured attendance window.", badge: "absent" },
    ],
  },
  {
    key: "class",
    label: "Class attendance",
    icon: "class",
    description: "SMS sent when a teacher records classroom attendance.",
    options: [
      { source: "classroom_manual", event: "class_entry",   label: "Present",  description: "Student marked present by teacher.", badge: "present" },
      { source: "classroom_manual", event: "class_late",    label: "Late",     description: "Student marked late by teacher.", badge: "late" },
      { source: "classroom_manual", event: "class_absent",  label: "Absent",   description: "Student marked absent by teacher.", badge: "absent" },
      { source: "classroom_manual", event: "class_excused", label: "Excused",  description: "Student excused by teacher.", badge: "info" },
    ],
  },
  {
    key: "boarding_morning",
    label: "Boarding attendance · Morning roll call",
    icon: "boarding",
    description: "SMS sent after the morning dormitory roll call is reconciled.",
    options: [
      { source: "dormitory_manual", event: "dormitory_morning_present",  label: "Present",     description: "Student present at morning roll call.", badge: "present" },
      { source: "dormitory_manual", event: "dormitory_morning_absent",   label: "Absent",      description: "Student absent at morning roll call — escalation SMS to parents.", badge: "absent" },
      { source: "dormitory_manual", event: "dormitory_morning_on_leave", label: "On leave",    description: "Student on approved leave during morning roll call.", badge: "info" },
    ],
  },
  {
    key: "boarding_evening",
    label: "Boarding attendance · Evening roll call",
    icon: "boarding",
    description: "SMS sent after the evening dormitory roll call is reconciled.",
    options: [
      { source: "dormitory_manual", event: "dormitory_evening_present",  label: "Present",     description: "Student present at evening roll call.", badge: "present" },
      { source: "dormitory_manual", event: "dormitory_evening_absent",   label: "Absent",      description: "Student absent at evening roll call — escalation SMS to parents.", badge: "absent" },
      { source: "dormitory_manual", event: "dormitory_evening_on_leave", label: "On leave",    description: "Student on approved leave during evening roll call.", badge: "info" },
    ],
  },
] as const;

const keyOf = (source: string, event: string) => `${source}:${event}`;

const BADGE_COLOR: Record<string, string> = {
  entry:   "bg-emerald-100 text-emerald-700",
  exit:    "bg-orange-100  text-orange-700",
  present: "bg-emerald-100 text-emerald-700",
  late:    "bg-amber-100   text-amber-700",
  absent:  "bg-red-100     text-red-700",
  info:    "bg-blue-100    text-blue-700",
};

function GroupIcon({ icon }: { icon: string }) {
  if (icon === "gate")    return <DoorOpen  className="h-5 w-5 text-primary" />;
  if (icon === "class")   return <BookOpen  className="h-5 w-5 text-primary" />;
  return                         <Home      className="h-5 w-5 text-primary" />;
}

function AttendanceMessagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mappings,  setMappings]  = useState<Record<string, Mapping>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [tmplRes, mapRes] = await Promise.all([
          apiRequest<Template[]>("/notifications/templates?is_active=true&limit=200", { auth: "school" }),
          apiRequest<Mapping[]>("/attendance/sms-settings", { auth: "school" }),
        ]);
        setTemplates(Array.isArray(tmplRes) ? tmplRes : []);
        const next: Record<string, Mapping> = {};
        (Array.isArray(mapRes) ? mapRes : []).forEach(m => { next[keyOf(m.source_type, m.event_type)] = m; });
        setMappings(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load SMS settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const templatesByTrigger = useMemo(() => {
    const g: Record<string, Template[]> = {};
    templates.forEach(t => { (g[t.trigger_type] ??= []).push(t); });
    return g;
  }, [templates]);

  /** Toggle send_sms on/off — immediately clears template_id if disabling */
  const toggleSms = (source: string, event: string) => {
    const k = keyOf(source, event);
    setMappings(cur => {
      const existing = cur[k];
      const nowOn = !(existing?.send_sms ?? false);
      return {
        ...cur,
        [k]: { ...existing, source_type: source, event_type: event, send_sms: nowOn, template_id: nowOn ? (existing?.template_id ?? null) : null },
      };
    });
  };

  const updateTemplate = (source: string, event: string, templateId: string) => {
    const k = keyOf(source, event);
    setMappings(cur => ({
      ...cur,
      [k]: {
        ...cur[k],
        source_type: source, event_type: event,
        template_id: templateId || null,
        send_sms: Boolean(templateId),
        template: templates.find(t => t.id === templateId) ?? null,
      },
    }));
  };

  const save = async (source: string, event: string, label: string) => {
    const k = keyOf(source, event);
    const m = mappings[k];
    setSaving(k);
    try {
      await apiRequest("/attendance/sms-settings", {
        method: "PUT",
        auth: "school",
        body: JSON.stringify({
          source_type: source,
          event_type:  event,
          template_id: m?.template_id ?? null,
          send_sms:    m?.send_sms ?? false,
        }),
      });
      toast.success(`"${label}" saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <MessageSquareText className="mt-1 h-5 w-5 text-primary shrink-0" />
          <div>
            <h2 className="font-display text-lg font-bold">Attendance SMS settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Control which events send an SMS to parents. Toggle each event on or off, then choose
              the message template. Gate attendance (entry and exit) is on by default.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map(group => (
            <div key={group.key} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
                <GroupIcon icon={group.icon} />
                <div>
                  <h3 className="font-semibold text-sm">{group.label}</h3>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
              </div>

              {/* Event rows */}
              <div className="divide-y divide-border">
                {group.options.map(opt => {
                  const k   = keyOf(opt.source, opt.event);
                  const m   = mappings[k];
                  const on  = m?.send_sms ?? false;
                  const avail = templatesByTrigger[opt.event] ?? [];
                  const isSaving = saving === k;

                  return (
                    <div key={k} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleSms(opt.source, opt.event)}
                          className={`mt-0.5 shrink-0 transition-colors ${on ? "text-primary" : "text-muted-foreground"}`}
                          title={on ? "Disable SMS" : "Enable SMS"}
                        >
                          {on
                            ? <ToggleRight className="h-6 w-6" />
                            : <ToggleLeft  className="h-6 w-6" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{opt.label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BADGE_COLOR[opt.badge]}`}>
                              {opt.badge}
                            </span>
                            {on && m?.template_id && <CheckCircle2 className="h-4 w-4 text-success" />}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>

                          {on && (
                            <div className="mt-3 space-y-2">
                              {avail.length === 0 ? (
                                <p className="text-xs text-destructive">
                                  No message template registered for this event yet. Ask your system administrator to create one.
                                </p>
                              ) : (
                                <select
                                  value={m?.template_id ?? ""}
                                  onChange={e => updateTemplate(opt.source, opt.event, e.target.value)}
                                  className="h-9 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-sm"
                                >
                                  <option value="">— choose a message template —</option>
                                  {avail.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              )}

                              {m?.template_id && (
                                <div className="max-w-lg rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                                  {m.template?.body_en ?? templates.find(t => t.id === m.template_id)?.body_en}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => void save(opt.source, opt.event, opt.label)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                              >
                                <Save className="h-3 w-3" />
                                {isSaving ? "Saving…" : "Save"}
                              </button>
                            </div>
                          )}

                          {!on && (
                            <button
                              type="button"
                              onClick={() => void save(opt.source, opt.event, opt.label)}
                              disabled={isSaving}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              {isSaving ? "Saving…" : "Save (disabled)"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Request a custom message (school admin → super admin approval) ─── */}
      <RequestCustomMessageSection />
    </div>
  );
}

// ── Request Custom Message Section ──────────────────────────────────────────
function RequestCustomMessageSection() {
  const ALL_EVENTS = GROUPS.flatMap(g => g.options.map(o => ({ value: o.event, label: `${g.label} — ${o.label}` })));
  const [open,        setOpen]        = useState(false);
  const [event,       setEvent]       = useState<string>(ALL_EVENTS[0].value);
  const [name,        setName]        = useState("");
  const [body,        setBody]        = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [myRequests,  setMyRequests]  = useState<Array<{ id: string; name: string; trigger_type: string; is_active: boolean; created_at: string }>>([]);

  useEffect(() => {
    // Load school's own pending/approved templates
    apiRequest<any>("/notifications/templates?is_active=false&limit=50", { auth: "school" })
      .then(res => {
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setMyRequests(list.map((t: any) => ({ id: String(t.id), name: t.name, trigger_type: t.trigger_type, is_active: t.is_active, created_at: t.created_at })));
      }).catch(() => {});
  }, [submitting]);

  const submit = async () => {
    if (!name.trim() || !body.trim()) { toast.error("Name and message body are required"); return; }
    setSubmitting(true);
    try {
      await apiRequest("/notifications/templates", {
        method: "POST", auth: "school",
        body: JSON.stringify({
          name: name.trim(),
          slug: `school-custom-${event}-${Date.now()}`,
          trigger_type: event,
          body_en: body.trim(),
          is_active: false,  // pending super-admin approval
        }),
      });
      toast.success("Custom message submitted for super-admin approval");
      setOpen(false); setName(""); setBody("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Submit failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Request a custom message</h3>
            <p className="text-xs text-muted-foreground">Write a custom SMS text for any event — a super admin will review and approve it before it becomes available.</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          {open ? "Close" : "Write request"}
        </button>
      </div>

      {open && (
        <div className="p-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1">Event type</label>
              <select value={event} onChange={e => setEvent(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {ALL_EVENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Template name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Custom morning absence message"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Message body</label>
            <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write the full SMS message here. Use ${student_name}, ${date}, ${time} as placeholders."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none" />
            <p className="mt-1 text-[10px] text-muted-foreground">Available: $&#123;student_name&#125; · $&#123;date&#125; · $&#123;time&#125;</p>
          </div>
          <button type="button" onClick={submit} disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" />{submitting ? "Submitting…" : "Submit for approval"}
          </button>
        </div>
      )}

      {/* Pending/approved custom requests */}
      {myRequests.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {myRequests.map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.trigger_type}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {r.is_active ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {r.is_active ? "Approved" : "Pending approval"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
