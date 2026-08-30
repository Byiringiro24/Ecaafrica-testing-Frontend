import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageSquareText, Save } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/messages")({ component: AttendanceMessagesPage });

type Template = {
  id: string;
  name: string;
  trigger_type: string;
  body_en: string;
  is_active: boolean;
};
type Mapping = {
  source_type: string;
  event_type: string;
  template_id: string | null;
  send_sms: boolean;
  template?: { name: string; body_en: string } | null;
};

const OPTIONS = [
  {
    source: "classroom_manual",
    event: "class_entry",
    label: "Class attendance · Present",
    description: "When classroom attendance marks a student present.",
  },
  {
    source: "classroom_manual",
    event: "class_late",
    label: "Class attendance · Late",
    description: "When classroom attendance marks a student late.",
  },
  {
    source: "classroom_manual",
    event: "class_absent",
    label: "Class attendance · Absent",
    description: "When classroom attendance marks a student absent.",
  },
  {
    source: "classroom_manual",
    event: "class_excused",
    label: "Class attendance · Excused",
    description: "When classroom attendance marks a student excused.",
  },
  {
    source: "dormitory_manual",
    event: "dormitory_morning_present",
    label: "Boarding attendance · Morning present",
    description: "Morning dormitory roll call.",
  },
  {
    source: "dormitory_manual",
    event: "dormitory_morning_absent",
    label: "Boarding attendance · Morning absent",
    description: "Morning dormitory roll call.",
  },
  {
    source: "dormitory_manual",
    event: "dormitory_evening_present",
    label: "Boarding attendance · Evening present",
    description: "Evening dormitory roll call.",
  },
  {
    source: "dormitory_manual",
    event: "dormitory_evening_absent",
    label: "Boarding attendance · Evening absent",
    description: "Evening dormitory roll call.",
  },
  {
    source: "gate_device",
    event: "school_entry",
    label: "Gate/device attendance · School entry",
    description: "When a learner enters through a gate device.",
  },
  {
    source: "gate_device",
    event: "school_exit",
    label: "Gate/device attendance · School exit",
    description: "When a learner leaves through a gate device.",
  },
  {
    source: "gate_device",
    event: "device_late",
    label: "Device attendance · Late",
    description: "When a configured device attendance window records a late scan.",
  },
  {
    source: "gate_device",
    event: "device_absent",
    label: "Device attendance · Absent",
    description: "When a configured device attendance window records an absence.",
  },
] as const;

const keyOf = (source: string, event: string) => `${source}:${event}`;

function AttendanceMessagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [templateResponse, mappingResponse] = await Promise.all([
          apiRequest<Template[]>("/notifications/templates?is_active=true&limit=200", {
            auth: "school",
          }),
          apiRequest<Mapping[]>("/attendance/sms-settings", { auth: "school" }),
        ]);
        setTemplates(Array.isArray(templateResponse) ? templateResponse : []);
        const next: Record<string, Mapping> = {};
        (Array.isArray(mappingResponse) ? mappingResponse : []).forEach((mapping) => {
          next[keyOf(mapping.source_type, mapping.event_type)] = mapping;
        });
        setMappings(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load attendance messages");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const templatesByTrigger = useMemo(() => {
    const grouped: Record<string, Template[]> = {};
    templates.forEach((template) => {
      (grouped[template.trigger_type] ??= []).push(template);
    });
    return grouped;
  }, [templates]);

  const updateMapping = (option: (typeof OPTIONS)[number], templateId: string) => {
    const existing = mappings[keyOf(option.source, option.event)];
    setMappings((current) => ({
      ...current,
      [keyOf(option.source, option.event)]: {
        ...existing,
        source_type: option.source,
        event_type: option.event,
        template_id: templateId || null,
        send_sms: Boolean(templateId),
        template: templates.find((template) => template.id === templateId) ?? null,
      },
    }));
  };

  const saveMapping = async (option: (typeof OPTIONS)[number]) => {
    const mapping = mappings[keyOf(option.source, option.event)];
    setSaving(keyOf(option.source, option.event));
    try {
      await apiRequest("/attendance/sms-settings", {
        method: "PUT",
        auth: "school",
        body: JSON.stringify({
          source_type: option.source,
          event_type: option.event,
          template_id: mapping?.template_id ?? null,
          send_sms: Boolean(mapping?.template_id),
        }),
      });
      toast.success(`${option.label} message saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save message selection");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <MessageSquareText className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">Attendance messages</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the messages registered by the system administrator for each attendance event.
              These selections control parent SMS notifications.
            </p>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading registered messages…
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {OPTIONS.map((option) => {
            const mapping = mappings[keyOf(option.source, option.event)];
            const available = templatesByTrigger[option.event] ?? [];
            return (
              <div
                key={keyOf(option.source, option.event)}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{option.label}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  {mapping?.template_id && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  )}
                </div>
                <select
                  value={mapping?.template_id ?? ""}
                  onChange={(event) => updateMapping(option, event.target.value)}
                  className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Disable SMS for this event</option>
                  {available.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {mapping?.template_id && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    {mapping.template?.body_en ??
                      templates.find((template) => template.id === mapping.template_id)?.body_en}
                  </p>
                )}
                {!available.length && (
                  <p className="mt-2 text-xs text-destructive">
                    No registered message exists for this event yet.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void saveMapping(option)}
                  disabled={saving === keyOf(option.source, option.event) || !available.length}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />{" "}
                  {saving === keyOf(option.source, option.event) ? "Saving…" : "Save selection"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
