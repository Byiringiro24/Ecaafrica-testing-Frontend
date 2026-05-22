import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ClipboardCheck, GraduationCap, MessageSquare, Info, CheckCheck } from "lucide-react";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_NOTIFICATIONS } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/notifications")({ component: NotificationsPage });

const ICONS: any = { attendance: ClipboardCheck, academic: GraduationCap, message: MessageSquare, system: Info };
const COLORS: any = { attendance: "bg-red-100 text-red-600", academic: "bg-indigo-100 text-indigo-700", message: "bg-blue-100 text-blue-600", system: "bg-gray-100 text-gray-600" };

function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "attendance" | "academic" | "system" | "message">("all");
  const [items, setItems] = useState(TEACHER_NOTIFICATIONS);
  const list = items.filter(n => filter === "all" || n.type === filter);

  return (
    <TeacherLayout title="Notifications">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 text-xs flex-wrap">
          {(["all", "attendance", "academic", "system", "message"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded font-semibold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{f}</button>
          ))}
        </div>
        <button onClick={() => setItems(items.map(i => ({ ...i, read: true })))} className="text-xs text-primary font-semibold inline-flex items-center gap-1 hover:underline"><CheckCheck className="h-3 w-3" /> Mark all as read</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
        {list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Bell className="h-10 w-10 mx-auto mb-2 opacity-40" /><p className="text-sm">No notifications</p></div>
        ) : list.map(n => {
          const Icon = ICONS[n.type];
          return (
            <div key={n.id} onClick={() => setItems(items.map(i => i.id === n.id ? { ...i, read: true } : i))} className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/40 ${!n.read ? "bg-primary/5" : ""}`}>
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${COLORS[n.type]}`}><Icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm">{n.title}</div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.description}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{n.timestamp}</div>
              </div>
              {n.type === "attendance" && !n.read && (
                <button className="text-xs font-semibold text-primary hover:underline">Submit Now</button>
              )}
            </div>
          );
        })}
      </div>
    </TeacherLayout>
  );
}
