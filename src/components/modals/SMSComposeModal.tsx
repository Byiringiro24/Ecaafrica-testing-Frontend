import { useEffect, useMemo, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SMS_TEMPLATES, fillTemplate } from "@/lib/mockData";
import { apiRequest } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  parentId?: string;
  studentId?: string;
  defaultStatus?: "Present" | "Absent" | "Late";
  parents?: {
    id: string;
    name: string;
    phone: string;
    studentIds?: string[];
  }[];
  students?: {
    id: string;
    name: string;
    class?: string;
    parentName?: string;
    parentPhone?: string;
  }[];
}

export function SMSComposeModal({
  open,
  onClose,
  parentId,
  studentId,
  defaultStatus = "Absent",
  parents,
  students
}: Props) {
  const [lang, setLang] = useState<"en" | "rw">("rw");
  const [status, setStatus] = useState(defaultStatus);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const parentSource = parents ?? [];
  const studentSource = students ?? [];

  const student = useMemo(() => {
    if (studentId) return studentSource.find(s => s.id === studentId);
    if (parentId) {
      const p = parentSource.find(x => x.id === parentId);
      const firstChildId = p?.studentIds?.[0];
      return firstChildId ? studentSource.find(s => s.id === firstChildId) : undefined;
    }
    return undefined;
  }, [studentId, parentId, parentSource, studentSource]);

  const parent = useMemo(() => {
    if (parentId) return parentSource.find(p => p.id === parentId);
    if (!student) return undefined;
    return parentSource.find(
      (p) => p.name === student.parentName || (student.parentPhone && p.phone === student.parentPhone)
    );
  }, [parentId, student, parentSource]);

  useEffect(() => {
    if (!open || !student || !parent) return;
    const tpl = SMS_TEMPLATES[lang][status];
    setMessage(fillTemplate(tpl, {
      parentName: parent.name,
      studentName: student.name,
      class: student.class ?? "—",
      date: new Date().toLocaleDateString("en-GB"),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      status: status.toLowerCase(),
    }));
  }, [open, lang, status, student, parent]);

  if (!open) return null;
  if (!student || !parent) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
        <div className="rounded-2xl bg-card p-6 max-w-sm">
          <p>No recipient selected.</p>
          <button onClick={onClose} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Close</button>
        </div>
      </div>
    );
  }

  const send = async () => {
    if (!parent.phone) { toast.error("Parent has no phone number"); return; }
    if (!message.trim()) { toast.error("Message is empty"); return; }
    setSending(true);
    try {
      await apiRequest("/notifications/send", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          channel: "sms",
          recipient_phone: parent.phone,
          recipient_type: "parent",
          recipient_id: parentId,
          message: message.trim(),
        }),
      });
      toast.success(`SMS sent to ${parent.name}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const over = message.length > 160;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Compose SMS</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">To</div><div className="font-semibold">{parent.name}</div><div className="text-xs text-muted-foreground">{parent.phone}</div></div>
            <div><div className="text-xs text-muted-foreground">Student</div><div className="font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.class}</div></div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">Trigger:</span>
            {(["Present","Absent","Late"] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${status === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                {s}
              </button>
            ))}
            <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden text-xs">
              {(["en","rw"] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  {l === "en" ? "English" : "Kinyarwanda"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground">SMS template — variables auto-filled</span>
              <span className={over ? "text-destructive font-semibold" : "text-muted-foreground"}>{message.length}/160</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={send} disabled={sending || !message.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  parentId?: string;
  studentId?: string;
  defaultStatus?: "Present" | "Absent" | "Late";
  parents?: {
    id: string;
    name: string;
    phone: string;
    studentIds?: string[];
  }[];
  students?: {
    id: string;
    name: string;
    class?: string;
    parentName?: string;
    parentPhone?: string;
  }[];
}

export function SMSComposeModal({
  open,
  onClose,
  parentId,
  studentId,
  defaultStatus = "Absent",
  parents,
  students
}: Props) {
  const [lang, setLang] = useState<"en" | "rw">("rw");
  const [status, setStatus] = useState(defaultStatus);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const parentSource = parents ?? PARENTS;
  const studentSource = students ?? STUDENTS;

  const student = useMemo(() => {
    if (studentId) return studentSource.find(s => s.id === studentId);
    if (parentId) {
      const p = parentSource.find(x => x.id === parentId);
      const firstChildId = p?.studentIds?.[0];
      return firstChildId ? studentSource.find(s => s.id === firstChildId) : undefined;
    }
    return undefined;
  }, [studentId, parentId, parentSource, studentSource]);

  const parent = useMemo(() => {
    if (parentId) return parentSource.find(p => p.id === parentId);
    if (!student) return undefined;
    return parentSource.find(
      (p) => p.name === student.parentName || (student.parentPhone && p.phone === student.parentPhone)
    );
  }, [parentId, student, parentSource]);

  useEffect(() => {
    if (!open || !student || !parent) return;
    const tpl = SMS_TEMPLATES[lang][status];
    setMessage(fillTemplate(tpl, {
      parentName: parent.name,
      studentName: student.name,
      class: student.class ?? "—",
      date: new Date().toLocaleDateString("en-GB"),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      status: status.toLowerCase(),
    }));
  }, [open, lang, status, student, parent]);

  if (!open) return null;
  if (!student || !parent) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
        <div className="rounded-2xl bg-card p-6 max-w-sm">
          <p>No recipient selected.</p>
          <button onClick={onClose} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Close</button>
        </div>
      </div>
    );
  }

  const send = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success(`SMS sent to ${parent.name}`);
      onClose();
    }, 900);
  };

  const over = message.length > 160;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Compose SMS</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">To</div><div className="font-semibold">{parent.name}</div><div className="text-xs text-muted-foreground">{parent.phone}</div></div>
            <div><div className="text-xs text-muted-foreground">Student</div><div className="font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.class}</div></div>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs font-semibold text-muted-foreground">Trigger:</span>
            {(["Present","Absent","Late"] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${status === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                {s}
              </button>
            ))}
            <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden text-xs">
              {(["en","rw"] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  {l === "en" ? "English" : "Kinyarwanda"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground">SMS template — variables auto-filled</span>
              <span className={over ? "text-destructive font-semibold" : "text-muted-foreground"}>{message.length}/160</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={send} disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}
