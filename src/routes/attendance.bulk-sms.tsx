/**
 * Bulk SMS — school admin can send a custom SMS to:
 *   • All parents
 *   • All parents of a specific class
 *   • All parents of students in a specific hostel/dormitory
 *   • One parent (searched by name or phone)
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Users, Search, Eye, MessageSquare, Home, BookOpen, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/bulk-sms")({ component: BulkSmsPage });

type ClassRecord      = { id: string; name: string };
type DormRecord       = { id: string; name: string; gender: string; hostel_name?: string | null };
type ParentRecord     = { id: string; first_name: string; last_name: string; phone: string; relationship: string };
type PreviewResult    = { parent_count: number; preview: boolean };
type SendResult       = { sent: number; failed: number; parent_count: number; preview: boolean };

type FilterType = "all" | "class" | "dormitory" | "parent";

const CHAR_LIMIT = 160;

function BulkSmsPage() {
  const [classes,    setClasses]    = useState<ClassRecord[]>([]);
  const [dorms,      setDorms]      = useState<DormRecord[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filter
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [classId,    setClassId]    = useState("");
  const [dormId,     setDormId]     = useState("");

  // Parent search
  const [parentQuery,   setParentQuery]   = useState("");
  const [parentResults, setParentResults] = useState<ParentRecord[]>([]);
  const [searchingPar,  setSearchingPar]  = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentRecord | null>(null);

  // Message
  const [message, setMessage] = useState("");

  // UI states
  const [preview,   setPreview]   = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [classRes, dormRes] = await Promise.all([
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
          apiRequest<any>("/boarding/dormitories?limit=100", { auth: "school" }),
        ]);
        setClasses(Array.isArray(classRes) ? classRes : (classRes as any)?.data ?? []);
        const dormData = Array.isArray(dormRes) ? dormRes : (dormRes as any)?.data ?? [];
        setDorms(dormData.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          gender: d.gender ?? "mixed",
          hostel_name: d.hostel_name ?? null,
        })));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Parent search — debounced
  useEffect(() => {
    if (filterType !== "parent") return;
    if (parentQuery.trim().length < 2) { setParentResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingPar(true);
      try {
        const res = await apiRequest<any>(
          `/parents?q=${encodeURIComponent(parentQuery.trim())}&limit=20`,
          { auth: "school" }
        );
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setParentResults(list.map((p: any) => ({
          id: String(p.id),
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          relationship: p.relationship ?? "",
        })));
      } catch { setParentResults([]); }
      finally { setSearchingPar(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [parentQuery, filterType]);

  const buildFilter = () => {
    if (filterType === "class")     return { type: "class",     class_id:     classId };
    if (filterType === "dormitory") return { type: "dormitory", dormitory_id: dormId };
    if (filterType === "parent")    return { type: "parent",    parent_id:    selectedParent?.id };
    return { type: "all" };
  };

  const canPreview = useMemo(() => {
    if (filterType === "class"     && !classId)          return false;
    if (filterType === "dormitory" && !dormId)           return false;
    if (filterType === "parent"    && !selectedParent)   return false;
    return true;
  }, [filterType, classId, dormId, selectedParent]);

  const canSend = canPreview && message.trim().length >= 5;

  const doPreview = async () => {
    setPreviewing(true); setPreview(null); setConfirmed(false);
    try {
      const res = await apiRequest<SendResult>("/notifications/bulk-sms", {
        method: "POST", auth: "school",
        body: JSON.stringify({ filter: buildFilter(), message: message || "preview", preview: true }),
      });
      setPreview(res as any);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally { setPreviewing(false); }
  };

  const doSend = async () => {
    if (!confirmed) { setConfirmed(true); return; }
    setSending(true);
    try {
      const res = await apiRequest<SendResult>("/notifications/bulk-sms", {
        method: "POST", auth: "school",
        body: JSON.stringify({ filter: buildFilter(), message: message.trim(), preview: false }),
      });
      const r = res as any;
      if (r.failed > 0) {
        toast.warning(`Sent ${r.sent}/${r.parent_count} messages. ${r.failed} failed.`);
      } else {
        toast.success(`Sent to ${r.sent} parent${r.sent !== 1 ? "s" : ""} successfully.`);
      }
      setMessage(""); setPreview(null); setConfirmed(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally { setSending(false); }
  };

  const charsLeft = CHAR_LIMIT - message.length;
  const overLimit = charsLeft < 0;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 h-5 w-5 text-primary shrink-0" />
          <div>
            <h2 className="font-display text-lg font-bold">Bulk SMS to parents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send a custom SMS to all parents, parents of a class, parents of a hostel,
              or one specific parent. Always preview before sending.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* Step 1 — Audience */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Step 1 — Choose audience</h3>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["all", "class", "dormitory", "parent"] as FilterType[]).map(ft => {
                const icons: Record<FilterType, React.ReactNode> = {
                  all:       <Users    className="h-4 w-4" />,
                  class:     <BookOpen className="h-4 w-4" />,
                  dormitory: <Home     className="h-4 w-4" />,
                  parent:    <UserCheck className="h-4 w-4" />,
                };
                const labels: Record<FilterType, string> = {
                  all: "All parents", class: "By class", dormitory: "By hostel", parent: "One parent",
                };
                return (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => { setFilterType(ft); setPreview(null); setConfirmed(false); }}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                      filterType === ft
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {icons[ft]}
                    {labels[ft]}
                  </button>
                );
              })}
            </div>

            {/* Class filter */}
            {filterType === "class" && (
              <select
                value={classId}
                onChange={e => { setClassId(e.target.value); setPreview(null); }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">— select a class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            {/* Dormitory filter */}
            {filterType === "dormitory" && (
              <select
                value={dormId}
                onChange={e => { setDormId(e.target.value); setPreview(null); }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">— select a hostel/dormitory —</option>
                {dorms.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.hostel_name ? `${d.hostel_name} — ` : ""}{d.name} ({d.gender})
                  </option>
                ))}
              </select>
            )}

            {/* Parent search */}
            {filterType === "parent" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={parentQuery}
                    onChange={e => { setParentQuery(e.target.value); setSelectedParent(null); setPreview(null); }}
                    placeholder="Search parent by name or phone…"
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
                  />
                </div>
                {searchingPar && <p className="text-xs text-muted-foreground">Searching…</p>}
                {parentResults.length > 0 && !selectedParent && (
                  <div className="rounded-lg border border-border bg-background shadow-md overflow-hidden">
                    {parentResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedParent(p); setParentResults([]); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/60 border-b border-border last:border-0"
                      >
                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                        <span className="text-muted-foreground text-xs">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedParent && (
                  <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm">
                    <span className="font-medium">{selectedParent.first_name} {selectedParent.last_name} — {selectedParent.phone}</span>
                    <button type="button" onClick={() => setSelectedParent(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 — Message */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Step 2 — Write message</h3>
            <textarea
              rows={4}
              value={message}
              onChange={e => { setMessage(e.target.value); setPreview(null); setConfirmed(false); }}
              placeholder="Type your message here…"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm resize-none ${overLimit ? "border-destructive" : "border-border"} bg-background`}
            />
            <div className={`text-right text-xs ${overLimit ? "text-destructive font-bold" : "text-muted-foreground"}`}>
              {message.length}/{CHAR_LIMIT} chars{overLimit ? " — exceeds one SMS unit" : ""}
            </div>
          </div>

          {/* Step 3 — Preview & Send */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Step 3 — Preview &amp; send</h3>

            <button
              type="button"
              onClick={doPreview}
              disabled={!canPreview || previewing}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              {previewing ? "Counting…" : "Preview recipient count"}
            </button>

            {preview && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                <span className="font-bold text-primary">{preview.parent_count}</span> parent{preview.parent_count !== 1 ? "s" : ""} will receive this message.
              </div>
            )}

            {confirmed && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                Click "Send now" again to confirm sending to {preview?.parent_count ?? "all"} parents. This cannot be undone.
              </div>
            )}

            <button
              type="button"
              onClick={doSend}
              disabled={!canSend || sending || overLimit}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                confirmed
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : confirmed ? "Confirm — Send now" : "Send SMS"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
