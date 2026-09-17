import { FormEvent, useEffect, useMemo, useState } from "react";
import { Headphones, MessageSquare, Plus, Send, TabletSmartphone, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listSchoolTickets,
  createSchoolTicket,
  replyToSchoolTicket,
  updateSchoolTicket,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/supportTickets";

type Props = { gateKeeper?: boolean };
const statusLabels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};
const statusStyles: Record<TicketStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

export default function SchoolSupportTickets({ gateKeeper = false }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    subject: "",
    category: "technical" as TicketCategory,
    priority: "medium" as TicketPriority,
    body: "",
  });
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  const load = async () => {
    try {
      setTickets(await listSchoolTickets());
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const visibleTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        `${ticket.ticket_number} ${ticket.subject} ${ticket.category}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [tickets, search],
  );

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;
    try {
      const created = await createSchoolTicket({
        ...form,
        subject: form.subject.trim(),
        body: form.body.trim(),
      });
      setTickets((previous) => [created, ...previous]);
      setSelectedId(created.id);
      setNewOpen(false);
      setForm({ subject: "", category: "technical", priority: "medium", body: "" });
      toast.success(gateKeeper ? "Ticket sent to school admin." : "Ticket sent to system admin.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to create ticket.");
    }
  };
  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      const message = await replyToSchoolTicket(selected.id, reply.trim());
      setTickets((previous) =>
        previous.map((ticket) =>
          ticket.id === selected.id
            ? { ...ticket, messages: [...ticket.messages, message] }
            : ticket,
        ),
      );
      setReply("");
      toast.success("Reply sent.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to send reply.");
    }
  };
  const changeStatus = async (next: TicketStatus) => {
    if (!selected || selected.audience !== "school_admin") return;
    try {
      const updated = await updateSchoolTicket(selected.id, next);
      setTickets((previous) =>
        previous.map((ticket) => (ticket.id === selected.id ? { ...ticket, ...updated } : ticket)),
      );
      toast.success("Ticket status updated.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update ticket.");
    }
  };

  const content = (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Support desk</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {gateKeeper
              ? "Report device and tablet issues to your school administrator."
              : "Manage school issues and escalate technical problems to the system administrator."}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="All tickets" value={tickets.length} />
        <MiniStat
          label="Open"
          value={tickets.filter((ticket) => ticket.status === "open").length}
          tone="amber"
        />
        <MiniStat
          label="Resolved"
          value={
            tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed")
              .length
          }
          tone="green"
        />
      </div>
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticket number, subject, or category"
          className="max-w-xl"
        />
      </div>
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading tickets…
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <TabletSmartphone className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">No tickets yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a ticket when you need help with a device, tablet, or another issue.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              selected={ticket.id === selectedId}
              onClick={() => setSelectedId(ticket.id)}
            />
          ))}
        </div>
      )}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitTicket}
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Create support ticket</h3>
                <p className="text-xs text-muted-foreground">
                  {gateKeeper
                    ? "The school administrator will receive this ticket."
                    : "The system administrator will receive this ticket."}
                </p>
              </div>
              <button type="button" onClick={() => setNewOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold">Subject</label>
                <Input
                  className="mt-1"
                  value={form.subject}
                  onChange={(event) => setForm({ ...form, subject: event.target.value })}
                  placeholder="e.g. Gate tablet cannot connect"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldSelect
                  label="Category"
                  value={form.category}
                  onChange={(value) => setForm({ ...form, category: value as TicketCategory })}
                  options={[
                    ["technical", "Device / tablet issue"],
                    ["feature_request", "Feature request"],
                    ["other", "Other"],
                  ]}
                />
                <FieldSelect
                  label="Priority"
                  value={form.priority}
                  onChange={(value) => setForm({ ...form, priority: value as TicketPriority })}
                  options={[
                    ["low", "Low"],
                    ["medium", "Medium"],
                    ["high", "High"],
                    ["critical", "Critical"],
                  ]}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Describe the issue</label>
                <textarea
                  required
                  rows={5}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
                  placeholder="Include the device name, error message, and what you have tried..."
                />
              </div>
              <Button type="submit" className="w-full">
                Send ticket
              </Button>
            </div>
          </form>
        </div>
      )}
      {selected && (
        <TicketDrawer
          ticket={selected}
          gateKeeper={gateKeeper}
          reply={reply}
          setReply={setReply}
          onClose={() => setSelectedId(null)}
          onReply={submitReply}
          onStatusChange={changeStatus}
          onCreateTicket={() => {
            setSelectedId(null);
            setNewOpen(true);
          }}
        />
      )}
    </div>
  );
  return gateKeeper ? (
    <GateKeeperLayout title="Support Tickets" subtitle="Report and track issues">
      {content}
    </GateKeeperLayout>
  ) : (
    <AppLayout title="Support Tickets" subtitle="Manage school and system support conversations">
      {content}
    </AppLayout>
  );
}

function MiniStat({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "amber" | "green";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
function TicketRow({
  ticket,
  selected,
  onClick,
}: {
  ticket: SupportTicket;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md ${selected ? "border-primary ring-2 ring-primary/10" : "border-border"}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[ticket.status]}`}
            >
              {statusLabels[ticket.status]}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ticket.source === "gate_keeper" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}
            >
              {ticket.source === "gate_keeper" ? "Gate keeper" : "System admin"}
            </span>
            <span className="text-xs capitalize text-muted-foreground">
              {ticket.priority} priority
            </span>
          </div>
          <h3 className="mt-2 truncate font-semibold">{ticket.subject}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.category === "technical"
              ? "Device / tablet issue"
              : ticket.category.replace("_", " ")}{" "}
            · Updated {new Date(ticket.updated_at).toLocaleString()}
          </p>
        </div>
        <MessageSquare className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}
function TicketDrawer({
  ticket,
  gateKeeper,
  reply,
  setReply,
  onClose,
  onReply,
  onStatusChange,
  onCreateTicket,
}: {
  ticket: SupportTicket;
  gateKeeper: boolean;
  reply: string;
  setReply: (value: string) => void;
  onClose: () => void;
  onReply: (event: FormEvent) => void;
  onStatusChange: (status: TicketStatus) => void;
  onCreateTicket: () => void;
}) {
  const canUpdateStatus = !gateKeeper && ticket.audience === "school_admin";
  const isClosed = ticket.status === "closed";
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
            <h2 className="mt-1 font-display text-xl font-bold">{ticket.subject}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[ticket.status]}`}
              >
                {statusLabels[ticket.status]}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                {ticket.source === "gate_keeper"
                  ? "Created by gate keeper"
                  : "Sent to system admin"}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {ticket.messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl p-4 text-sm ${message.sender_type === "school_user" ? "bg-muted" : "ml-6 bg-primary/10"}`}
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {message.sender_type === "school_user" ? "School" : "System administrator"} ·{" "}
                {new Date(message.created_at).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap leading-6">{message.body}</p>
            </div>
          ))}
          {ticket.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
        </div>
        <div className="space-y-3 border-t border-border p-5">
          <div className="flex gap-2">
            {canUpdateStatus && (
              <select
                value={ticket.status}
                onChange={(event) => onStatusChange(event.target.value as TicketStatus)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            )}
            <span className="flex items-center text-xs text-muted-foreground">
              {canUpdateStatus
                ? "School admin can update this gate-keeper ticket"
                : ticket.audience === "platform_admin"
                  ? "System admin manages this ticket status"
                  : "School admin can reply to this ticket"}
            </span>
          </div>
          {isClosed ? (
            <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                This ticket is closed. Create a new ticket to continue the conversation.
              </p>
              <Button type="button" onClick={onCreateTicket} className="shrink-0 gap-2">
                <Plus className="h-4 w-4" /> New ticket
              </Button>
            </div>
          ) : (
            <form onSubmit={onReply} className="flex gap-2">
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={2}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
                placeholder="Write a reply..."
              />
              <Button type="submit" size="icon" aria-label="Send reply">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
