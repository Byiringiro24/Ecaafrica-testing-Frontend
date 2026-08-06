import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Send, Users, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/parent-broadcasts")({
  component: ParentBroadcastsPage
});

type ClassRecord = { id: string; name: string; level: number };
type SectionRecord = { id: string; name: string; full_name: string; class_id: string };

type AudienceKind = "all" | "class" | "section";

type Audience =
  | { type: "all" }
  | { type: "class"; class_id: string }
  | { type: "section"; section_id: string };

type PreviewResult = { parent_count: number; notification_count: number };
type SendResult = { delivered: number; parent_count: number };

const TITLE_MAX = 255;
const BODY_MAX = 2000;

function ParentBroadcastsPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [kind, setKind] = useState<AudienceKind>("all");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [classList, sectionList] = await Promise.all([
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
          apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" })
        ]);
        setClasses(classList ?? []);
        setSections(sectionList ?? []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load classes and sections");
      } finally {
        setLoadingRefs(false);
      }
    };

    void load();
  }, []);

  const sectionsForClass = useMemo(
    () => (classId ? sections.filter((s) => s.class_id === classId) : sections),
    [sections, classId]
  );

  const audience = useMemo<Audience | null>(() => {
    if (kind === "all") return { type: "all" };
    if (kind === "class") return classId ? { type: "class", class_id: classId } : null;
    return sectionId ? { type: "section", section_id: sectionId } : null;
  }, [kind, classId, sectionId]);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const canSend =
    audience !== null && trimmedTitle.length >= 3 && trimmedBody.length >= 3;

  // Any change to who or what we're sending invalidates the recipient count, so
  // the operator can never send against a stale preview.
  useEffect(() => {
    setPreview(null);
  }, [kind, classId, sectionId]);

  const runPreview = async () => {
    if (!audience) return;
    try {
      setPreviewing(true);
      const result = await apiRequest<PreviewResult>("/notifications/parent-broadcasts/preview", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ audience })
      });
      setPreview(result);
      if (result.parent_count === 0) {
        toast.warning("No parents match this audience");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to preview audience");
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    if (!audience || !canSend) return;
    try {
      setSending(true);
      const result = await apiRequest<SendResult>("/notifications/parent-broadcasts", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ title: trimmedTitle, body: trimmedBody, audience })
      });
      toast.success(
        `Sent to ${result.parent_count} parent${result.parent_count === 1 ? "" : "s"} (${result.delivered} notifications)`
      );
      setTitle("");
      setBody("");
      setPreview(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to send broadcast");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const audienceLabel = () => {
    if (kind === "all") return "All parents in the school";
    if (kind === "class") {
      const c = classes.find((x) => x.id === classId);
      return c ? `Parents of ${c.name}` : "Select a class";
    }
    const s = sections.find((x) => x.id === sectionId);
    return s ? `Parents of ${s.full_name}` : "Select a section";
  };

  return (
    <AppLayout title="Parent Broadcasts" subtitle="Send an in-app notification to parents">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display font-bold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Audience
            </h3>

            {loadingRefs ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["all", "All parents"],
                    ["class", "By class"],
                    ["section", "By section"]
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setKind(value)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        kind === value
                          ? "bg-primary text-white"
                          : "border border-border text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {kind === "class" && (
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Select a class…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}

                {kind === "section" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={classId}
                      onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="">All classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Select a section…</option>
                      {sectionsForClass.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold">Message</h3>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="e.g. Term 2 Parents Meeting"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <div className="mt-1 text-[11px] text-muted-foreground">{trimmedTitle.length}/{TITLE_MAX}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                Body <span className="text-destructive">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                rows={6}
                placeholder="Write the notification parents will see in the app…"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
              <div className="mt-1 text-[11px] text-muted-foreground">{trimmedBody.length}/{BODY_MAX}</div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold">Summary</h3>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Sending to</div>
              <div className="font-semibold">{audienceLabel()}</div>
            </div>

            {preview ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="font-display text-3xl font-bold text-primary">{preview.parent_count}</div>
                <div className="text-xs text-muted-foreground">
                  parents · {preview.notification_count} notification{preview.notification_count === 1 ? "" : "s"}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Preview the audience to see how many parents will be reached.
              </p>
            )}

            <button
              onClick={runPreview}
              disabled={!audience || previewing}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent/40 disabled:opacity-50"
            >
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Preview audience
            </button>

            <button
              onClick={() => setConfirming(true)}
              disabled={!canSend || sending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send broadcast
            </button>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display font-bold mb-3">Parent app preview</h3>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-sm font-bold">{trimmedTitle || "Notification title"}</div>
              <div className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line">
                {trimmedBody || "Your message body appears here."}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Delivered in-app only — this does not send SMS.
            </p>
          </section>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-display font-bold">Send this broadcast?</h3>
            </div>
            <div className="px-6 py-5 space-y-2 text-sm">
              <div className="text-muted-foreground text-xs">Audience</div>
              <div className="font-semibold">{audienceLabel()}</div>
              {preview && (
                <div className="text-xs text-muted-foreground">
                  Reaching {preview.parent_count} parents ({preview.notification_count} notifications)
                </div>
              )}
              <div className="rounded-lg bg-muted/40 p-3 mt-2">
                <div className="font-bold">{trimmedTitle}</div>
                <div className="mt-1 text-xs whitespace-pre-line">{trimmedBody}</div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Notifications cannot be recalled once sent.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
