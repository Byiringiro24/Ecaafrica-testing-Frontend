import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Search, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { PARENT_MESSAGES, SMS_TEMPLATES } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/messages")({ component: MessagesPage });

function MessagesPage() {
  const [active, setActive] = useState(PARENT_MESSAGES[0].id);
  const [filter, setFilter] = useState<"all" | "unread" | "sent">("all");
  const [text, setText] = useState("");
  const [sms, setSms] = useState(true);
  const [compose, setCompose] = useState(false);

  const list = PARENT_MESSAGES.filter(m => filter === "all" || (filter === "unread" && m.unread));
  const current = PARENT_MESSAGES.find(m => m.id === active)!;

  const send = () => {
    if (!text.trim()) return;
    toast.success(sms ? "Message sent via SMS" : "Message sent");
    current.thread.push({ from: "teacher", text, time: "just now" });
    setText("");
  };

  return (
    <TeacherLayout title="Parent Messages" subtitle="Communicate directly with parents">
      <div className="flex justify-end mb-4">
        <button onClick={() => setCompose(true)} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"><Plus className="h-4 w-4" /> New Message</button>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" placeholder="Search…" /></div>
            <div className="flex gap-1 text-xs">
              {(["all", "unread", "sent"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded font-semibold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map(m => (
              <button key={m.id} onClick={() => setActive(m.id)} className={`w-full text-left p-3 border-b border-border hover:bg-muted/40 ${active === m.id ? "bg-primary/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">{m.parentName.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm truncate">{m.parentName}</div>
                      {m.unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">re: {m.studentName}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{m.preview}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{m.timestamp}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="font-semibold">{current.parentName}</div>
            <div className="text-xs text-muted-foreground">Parent of <b>{current.studentName}</b> · {current.studentClass} · {current.phone}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {current.thread.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "teacher" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.from === "teacher" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  <div>{msg.text}</div>
                  <div className={`text-[10px] mt-1 ${msg.from === "teacher" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <select onChange={e => { const t = SMS_TEMPLATES.find(x => x.id === e.target.value); if (t) setText(t.text); }} className="h-7 rounded border border-input bg-background px-2 text-xs">
                <option value="">Insert template…</option>
                {SMS_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> Send via SMS</label>
              {text && <span className="ml-auto text-muted-foreground">{text.length}/160 chars · {Math.ceil(text.length / 160)} SMS</span>}
            </div>
            <div className="flex gap-2">
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type message…" className="flex-1 rounded-md border border-input bg-background p-2 text-sm min-h-[44px]" />
              <button onClick={send} className="h-11 px-4 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2"><Send className="h-4 w-4" /> Send</button>
            </div>
          </div>
        </div>
      </div>

      {compose && <ComposeModal onClose={() => setCompose(false)} />}
    </TeacherLayout>
  );
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">New Message</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setLoading(true); await new Promise(r => setTimeout(r, 500)); toast.success("Message sent"); onClose(); }}>
          <div><label className="text-sm font-medium">To</label><input required placeholder="Search parent or student…" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
          <div><label className="text-sm font-medium">Subject (optional)</label><input className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <textarea value={text} onChange={e => setText(e.target.value)} required className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm min-h-[100px]" placeholder="Mwaramutse / Good morning…" />
            <div className="text-[11px] text-muted-foreground mt-1">{text.length}/160 chars · Will be sent as {Math.max(1, Math.ceil(text.length / 160))} SMS</div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}
