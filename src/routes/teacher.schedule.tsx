import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { teacherRouteGuard, getSchoolAuth } from "@/lib/schoolAuth";
import { Printer, List, Grid3X3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/schedule")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: SchedulePage
});

type Period = { id: string; name: string; start_time: string; end_time: string; is_break: boolean; sort_order: number };
type Slot = { id: string; section_id: string; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; room?: string | null };
type Section = { id: string; name: string; full_name?: string | null };
type Subject = { id: string; name: string; code?: string | null };

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
];

const AUTH = { auth: "school" as const };

/** Renders a period time as "3:30 PM". Accepts "HH:mm", "HH:mm:ss" or an ISO datetime. */
function formatPeriodTime(value?: string | null) {
  if (!value) return "";
  const match = /(\d{1,2}):(\d{2})/.exec(
    value.includes("T") ? value.slice(value.indexOf("T") + 1) : value,
  );
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function formatPeriodRange(start?: string | null, end?: string | null) {
  const from = formatPeriodTime(start);
  const to = formatPeriodTime(end);
  if (!from && !to) return "";
  return `${from} – ${to}`;
}

function SchedulePage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const auth = getSchoolAuth();
  const teacherId = auth?.user?.id ?? "";
  const teacherName = auth?.user?.name ?? "Teacher";

  useEffect(() => {
    if (!teacherId) { setLoading(false); return; }
    (async () => {
      try {
        const [periodData, slotData, sectionData, subjectData] = await Promise.all([
          apiRequest<Period[]>("/timetable-periods?limit=50", AUTH),
          apiRequest<Slot[]>(`/timetable-slots?teacher_id=${teacherId}&limit=200`, AUTH),
          apiRequest<Section[]>("/sections?limit=200", AUTH),
          apiRequest<Subject[]>("/subjects?limit=200", AUTH),
        ]);
        setPeriods((periodData ?? []).sort((a, b) => a.sort_order - b.sort_order));
        setSlots(slotData ?? []);
        setSections(sectionData ?? []);
        setSubjects(subjectData ?? []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load your timetable");
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherId]);

  const sectionName = (id: string) => {
    const s = sections.find((x) => x.id === id);
    return s?.full_name || s?.name || "—";
  };
  const subjectName = (id: string) => subjects.find((x) => x.id === id)?.name ?? "—";

  const slotMap = useMemo(() => {
    const map = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const key = `${s.period_id}:${s.day_of_week}`;
      const existing = map.get(key);
      if (existing) existing.push(s);
      else map.set(key, [s]);
    });
    return map;
  }, [slots]);

  const listByDay = useMemo(
    () =>
      DAYS.map((day) => ({
        day,
        entries: periods.flatMap((p) =>
          (slotMap.get(`${p.id}:${day.value}`) ?? []).map((slot) => ({ period: p, slot })),
        ),
      })).filter((d) => d.entries.length > 0),
    [periods, slotMap],
  );

  // Slots can outlive the period they referenced (periods are soft-deleted), so only
  // count lessons that land on a period still in the timetable.
  const visibleSlots = useMemo(() => {
    const livePeriodIds = new Set(periods.map((p) => p.id));
    return slots.filter((s) => livePeriodIds.has(s.period_id));
  }, [slots, periods]);

  const totalLessons = visibleSlots.length;

  if (loading) {
    return (
      <TeacherLayout title="My Timetable" subtitle={teacherName}>
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="My Timetable" subtitle={teacherName}>
      <div className="flex items-center justify-between mb-5 no-print">
        <div className="text-sm text-muted-foreground">
          {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"} scheduled per week
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("grid")} className={`h-9 w-9 grid place-items-center rounded-md ${view === "grid" ? "bg-primary text-primary-foreground" : "border border-border"}`} aria-label="Grid view"><Grid3X3 className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`h-9 w-9 grid place-items-center rounded-md ${view === "list" ? "bg-primary text-primary-foreground" : "border border-border"}`} aria-label="List view"><List className="h-4 w-4" /></button>
          <button onClick={() => window.print()} className="h-9 px-3 rounded-md border border-border text-sm font-semibold inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>

      <div className="print-area timetable-print">
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">My Timetable</h1>
          <p className="text-sm text-gray-600">{teacherName}</p>
        </div>

        {periods.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No periods have been set up by your school yet.
          </div>
        ) : totalLessons === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            You have no lessons assigned yet. Contact your school admin if this looks wrong.
          </div>
        ) : view === "grid" ? (
          <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3 w-40">Period</th>
                  {DAYS.map((d) => <th key={d.value} className="text-center p-3">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 align-top">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground whitespace-nowrap">{formatPeriodRange(p.start_time, p.end_time)}</div>
                    </td>
                    {DAYS.map((d) => {
                      if (p.is_break) {
                        return <td key={d.value} className="p-2"><div className="rounded bg-muted text-muted-foreground text-center text-xs py-3">{p.name}</div></td>;
                      }
                      const daySlots = slotMap.get(`${p.id}:${d.value}`) ?? [];
                      return (
                        <td key={d.value} className="p-2 align-top">
                          {daySlots.length > 0 ? (
                            <div className="space-y-1">
                              {daySlots.map((slot) => (
                                <div key={slot.id} className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-center">
                                  <div className="font-bold text-primary text-sm">{sectionName(slot.section_id)}</div>
                                  <div className="text-[10px] text-muted-foreground">{subjectName(slot.subject_id)}</div>
                                  {slot.room && <div className="text-[10px] text-muted-foreground">Room {slot.room}</div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded bg-muted/40 h-12" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {listByDay.map(({ day, entries }) => (
              <div key={day.value} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="bg-muted px-4 py-2 text-xs font-bold uppercase">{day.label}</div>
                <div className="divide-y divide-border">
                  {entries.map(({ period, slot }) => (
                    <div key={slot.id} className="flex items-center gap-4 p-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">{period.name}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {sectionName(slot.section_id)} · {subjectName(slot.subject_id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPeriodRange(period.start_time, period.end_time)}
                          {slot.room ? ` · Room ${slot.room}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
