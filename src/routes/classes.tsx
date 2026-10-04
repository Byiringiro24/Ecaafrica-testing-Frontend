import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus, Search, User, DoorOpen, Eye, Pencil, X, Trash2, Download, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  levelBadgeClass, levelBorderClass,
  type ClassInfo,
} from "@/lib/mockData";
import { apiRequest } from "@/lib/api";
import { localDateInputValue } from "@/lib/dateInput";
import { fetchTodayAttendance } from "@/lib/device-logs-api";
import type { DeviceLog } from "@/lib/device-logs-types";
import { studentIdNumber } from "@/lib/studentIdentity";
import {
  downloadStudentImportTemplate,
  makeStudentImportCsvFile,
  parseStudentImportFile,
  type StudentImportIssue,
  type StudentImportParseResult
} from "@/lib/studentImport";
import { getSchoolAuth, isSchoolAdminRole } from "@/lib/schoolAuth";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/classes")({ component: ClassesPage });

type ClassRecord = {
  id: string;
  name: string;
  level: number;
  level_id?: string | null;
  level_label?: string | null;
  description?: string | null;
  academic_year_id?: string | null;
  combinations?: { id: string; code: string; name: string }[];
};
type CombinationRecord = { id: string; code: string; name: string; subjects?: { id: string; name: string; code?: string | null }[] };

type LevelRecord = {
  id: string;
  label: string;
  sort_order: number;
  is_active?: boolean;
};

type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
  capacity?: number | null;
  room?: string | null;
  class_teacher_id?: string | null;
};

type AcademicYearRecord = {
  id: string;
  name: string;
  is_current?: boolean | null;
};

type TeacherRecord = {
  id: string;
  name?: string | null;
  role?: string | null;
};

type ClassFormPayload = {
  levelId: string;
  section: string;
  teacherId?: string | null;
  room?: string | null;
  capacity: number;
  academicYearId?: string | null;
  combinationIds?: string[];
};

type StudentCountResponse = {
  data: unknown[];
  meta?: { total?: number };
};

type ApiStatus = "present" | "absent" | "late" | "excused";

type ApiRecord = {
  id: string;
  session_id: string;
  status: ApiStatus;
  scanned_at?: string | null;
  created_at?: string | null;
};

type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
};

type ApiStudent = { id: string; student_id_number?: string | null };

const normalizeSectionKey = (value: string) => value.toLowerCase().replace(/\s+/g, "");
const MAX_CAPACITY = 32767;
const parseLevelNumber = (value: string) => {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 1;
};
const toClassName = (levelNumber: number) => `S${levelNumber}`;
const isPresentStatus = (status: ApiStatus) => status === "present" || status === "late" || status === "excused";
const isMorningDeviceLog = (log: DeviceLog) => {
  const label = `${log.sessionName ?? ""} ${log.statusLabel ?? ""}`.toLowerCase();
  return !label.includes("evening") && !label.includes("night");
};
const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { weekday: "short" });
const getLastDates = (days: number) => {
  const result: string[] = [];
  const base = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const next = new Date(base);
    next.setDate(base.getDate() - i);
    result.push(next.toISOString().slice(0, 10));
  }
  return result;
};

function ClassesPage() {
  const [list, setList] = useState<ClassInfo[]>([]);
  const [levels, setLevels] = useState<LevelRecord[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYearRecord | null>(null);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [combinations, setCombinations] = useState<CombinationRecord[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [todayAttendance, setTodayAttendance] = useState<Record<string, { present: number; total: number }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState<ClassInfo | null>(null);
  const [detail, setDetail] = useState<ClassInfo | null>(null);
  const [editing, setEditing] = useState<ClassInfo | null>(null);
  const role = getSchoolAuth()?.user?.role ?? null;
  const canImport = !role || isSchoolAdminRole(role);

  const teacherMap = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher]));
  }, [teachers]);

  const buildClassList = (
    classes: ClassRecord[],
    sections: SectionRecord[],
    teacherLookup: Map<string, TeacherRecord>,
    studentCountLookup: Record<string, number>
  ) => {
    const classMap = new Map(classes.map((item) => [item.id, item]));

    return sections.reduce<ClassInfo[]>((acc, section) => {
      const cls = classMap.get(section.class_id);
      if (!cls) return acc;

      const displayName = `${cls.name}${section.name}`;
      const levelLabel = cls.level_label ?? `Level ${cls.level}`;
      const teacher = section.class_teacher_id
        ? teacherLookup.get(section.class_teacher_id)?.name ?? "Unassigned"
        : "Unassigned";

      acc.push({
        id: section.id,
        name: displayName,
        fullName: section.full_name,
        level: levelLabel,
        levelId: cls.level_id ?? undefined,
        levelLabel,
        section: section.name,
        teacher,
        teacherId: section.class_teacher_id ?? null,
        room: section.room ?? "",
        capacity: section.capacity ?? 0,
        studentCount: studentCountLookup[section.id] ?? 0,
        classId: cls.id,
        sectionId: section.id,
        academicYearId: cls.academic_year_id ?? null,
        combinationIds: (cls.combinations ?? []).map((combination) => combination.id),
        combinations: cls.combinations ?? []
      });

      return acc;
    }, []);
  };

  const loadStudentCounts = async (sections: SectionRecord[]) => {
    if (sections.length === 0) {
      setStudentCounts({});
      return;
    }

    try {
      const counts = await Promise.all(
        sections.map(async (section) => {
          try {
            const response = await apiRequest<StudentCountResponse>(
              `/students?section_id=${section.id}&limit=1`,
              { auth: "school", returnMeta: true }
            );
            return [section.id, response.meta?.total ?? 0] as const;
          } catch {
            return [section.id, 0] as const;
          }
        })
      );

      const next: Record<string, number> = {};
      counts.forEach(([id, count]) => {
        next[id] = count;
      });
      setStudentCounts(next);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load student counts");
    }
  };

  const loadClassData = async () => {
    setLoading(true);
    try {
      const [classes, sections] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" })
      ]);

      setClassRecords(classes);
      setSectionRecords(sections);
      void loadStudentCounts(sections);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const loadLevels = async () => {
    try {
      const levelRecords = await apiRequest<LevelRecord[]>("/levels?limit=200", {
        auth: "school"
      });
      setLevels(levelRecords);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load levels");
    }
  };

  const loadAcademicYears = async () => {
    try {
      const years = await apiRequest<AcademicYearRecord[]>("/academic-years?limit=50", {
        auth: "school"
      });
      setAcademicYears(years);
      const current = years.find((year) => year.is_current) ?? years[0] ?? null;
      setCurrentYear(current);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load academic years");
    }
  };

  const loadTeachers = async () => {
    try {
      const users = await apiRequest<TeacherRecord[]>("/users?role=teacher&limit=200", {
        auth: "school"
      });
      setTeachers(users);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load teachers");
    }
  };

  useEffect(() => {
    loadLevels();
    loadClassData();
    loadAcademicYears();
    loadTeachers();
    apiRequest<CombinationRecord[]>("/combinations?limit=200", { auth: "school" }).then(setCombinations).catch(() => setCombinations([]));
  }, []);

  useEffect(() => {
    if (sectionRecords.length === 0) {
      setTodayAttendance({});
      return;
    }

    let active = true;
    const loadAttendance = async () => {
      const today = localDateInputValue();
      try {
        const [deviceResponse, rosterBatches] = await Promise.all([
          fetchTodayAttendance().catch(() => ({ data: [] as DeviceLog[] })),
          Promise.all(sectionRecords.map((section) => apiRequest<ApiStudent[]>(`/students?section_id=${section.id}&limit=1000`, { auth: "school" }).catch(() => [])))
        ]);

        if (!active) return;

        const next: Record<string, { present: number; total: number }> = {};
        const studentSection = new Map<string, string>();
        rosterBatches.forEach((students, index) => students.forEach((student) => {
          studentSection.set(student.id, sectionRecords[index].id);
          if (student.student_id_number) studentSection.set(student.student_id_number, sectionRecords[index].id);
        }));
        const seen = new Set<string>();
        deviceResponse.data.filter(isMorningDeviceLog).forEach((log) => {
          const sectionId = studentSection.get(String(log.studentId));
          if (!sectionId || seen.has(`${sectionId}:${log.studentId}`)) return;
          seen.add(`${sectionId}:${log.studentId}`);
          const current = next[sectionId] ?? { present: 0, total: studentCounts[sectionId] ?? 0 };
          if (isPresentStatus((log.status || "present").toLowerCase() as ApiStatus)) current.present += 1;
          next[sectionId] = current;
        });
        sectionRecords.forEach((section) => { if (!next[section.id]) next[section.id] = { present: 0, total: studentCounts[section.id] ?? 0 }; });
        setTodayAttendance(next);
      } catch (error: any) {
        if (active) toast.error(error?.message ?? "Failed to load attendance");
      }
    };

    loadAttendance();
    return () => {
      active = false;
    };
  }, [sectionRecords, studentCounts]);

  useEffect(() => {
    setList(buildClassList(classRecords, sectionRecords, teacherMap, studentCounts));
  }, [classRecords, sectionRecords, teacherMap, studentCounts]);

  const filtered = list.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.teacher.toLowerCase().includes(search.toLowerCase())
  );
  const showSkeleton = loading && list.length === 0;

  const todayPresent = (sectionId?: string | null) => {
    if (!sectionId) return 0;
    return todayAttendance[sectionId]?.present ?? 0;
  };

  const handleSaveClass = async (payload: ClassFormPayload, target?: ClassInfo) => {
    const selectedLevel = levels.find((item) => item.id === payload.levelId);
    const sectionName = payload.section.trim().toUpperCase();
    const roomValue = (payload.room ?? "").trim();
    const normalizedYearId =
      payload.academicYearId === undefined
        ? currentYear?.id ?? null
        : payload.academicYearId || null;

    if (!sectionName) {
      toast.error("Section is required");
      return false;
    }

    if (!selectedLevel) {
      toast.error("Select a level first");
      return false;
    }

    if (!Number.isInteger(payload.capacity) || payload.capacity < 1 || payload.capacity > MAX_CAPACITY) {
      toast.error(`Capacity must be a whole number between 1 and ${MAX_CAPACITY}`);
      return false;
    }

    setSaving(true);
    try {
      const className = selectedLevel.label;
      let classRecord = classRecords.find(
        (item) =>
          item.name === className &&
          (normalizedYearId
            ? item.academic_year_id === normalizedYearId
            : !item.academic_year_id)
      );

      if (!classRecord) {
        const classPayload: Record<string, any> = {
          name: className,
          level_id: selectedLevel.id,
          level: selectedLevel.sort_order
        };
        if (normalizedYearId) {
          classPayload.academic_year_id = normalizedYearId;
        }
        if (payload.combinationIds?.length) classPayload.combination_ids = payload.combinationIds;

        classRecord = await apiRequest<ClassRecord>("/classes", {
          method: "POST",
          body: JSON.stringify(classPayload),
          auth: "school"
        });
        setClassRecords((prev) => [...prev, classRecord!]);
      }

      if (!classRecord) {
        throw new Error("Unable to resolve class record");
      }

      const sectionPayload = {
        class_id: classRecord.id,
        name: sectionName,
        full_name: `${className} ${sectionName}`,
        capacity: payload.capacity,
        room: roomValue ? roomValue : null,
        class_teacher_id: payload.teacherId || undefined
      };

      if (target?.sectionId) {
        await apiRequest(`/sections/${target.sectionId}`, {
          method: "PATCH",
          body: JSON.stringify(sectionPayload),
          auth: "school"
        });
      } else {
        await apiRequest<SectionRecord>("/sections", {
          method: "POST",
          body: JSON.stringify(sectionPayload),
          auth: "school"
        });
      }

      await loadClassData();
      toast.success(target ? "Class updated" : "Class created");
      return true;
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save class");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (target: ClassInfo) => {
    if (!target.sectionId) {
      toast.error("Missing section reference");
      return false;
    }

    setSaving(true);
    try {
      await apiRequest(`/sections/${target.sectionId}`, {
        method: "DELETE",
        auth: "school"
      });
      await loadClassData();
      toast.success("Class deleted");
      return true;
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete class");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Class Management" subtitle={`${list.length} classes — school-defined levels`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class or teacher…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => setAddOpen(true)}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Class
        </button>
        <button onClick={() => setLevelOpen(true)}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted">
          <Plus className="h-4 w-4" /> Add Level createded
        </button>
      </div>

      {loading && (
        <div className="mt-3 text-xs text-muted-foreground">Loading classes…</div>
      )}

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {showSkeleton ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={`class-skeleton-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full col-span-2" />
              </div>
            </div>
          ))
        ) : (
          filtered.map(c => {
            const present = todayPresent(c.sectionId);
            const pct = c.studentCount ? Math.round((present / c.studentCount) * 100) : 0;
            return (
              <div key={c.id} className={`rounded-xl border border-l-4 border-border bg-card p-5 shadow-sm hover:shadow-md transition ${levelBorderClass(c.level)}`}>
                <div className="flex items-start justify-between">
                  <div className={`px-3 py-1.5 rounded-lg font-display font-bold text-lg ${levelBadgeClass(c.level)}`}>{c.name}</div>
                  <span className="text-xs text-muted-foreground">{c.studentCount}/{c.capacity}</span>
                </div>
                <div className="mt-3">
                  <div className="font-semibold">{c.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{c.level} — Section {c.section}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground"><User className="h-3.5 w-3.5" />{c.teacher}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><DoorOpen className="h-3.5 w-3.5" />{c.room || "—"}</div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Today's attendance</span>
                    <span className="font-semibold">{present} Present ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setDetail(c)} className="flex-1 min-w-35 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                    <Eye className="h-3.5 w-3.5" /> View Details
                  </button>
                  <button onClick={() => setEditing(c)} className="flex-1 min-w-35 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-semibold hover:bg-primary/20">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (!canImport) {
                        toast.error("Only School Admins can import students.");
                        return;
                      }
                      setImportOpen(c);
                    }}
                    className={`flex-1 min-w-35 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted ${!canImport ? "opacity-60 cursor-not-allowed" : ""}`}
                    title={!canImport ? "School Admin only" : ""}
                    disabled={!canImport}
                  >
                    <Upload className="h-3.5 w-3.5" /> Import Students
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!showSkeleton && filtered.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No class records found.
        </div>
      )}

      {addOpen && (
        <ClassFormModal
          levels={levels}
          teachers={teachers}
          academicYears={academicYears}
          combinations={combinations}
          defaultAcademicYearId={currentYear?.id ?? null}
          saving={saving}
          onClose={() => setAddOpen(false)}
          onSubmit={async (payload) => {
            const ok = await handleSaveClass(payload);
            if (ok) setAddOpen(false);
          }}
        />
      )}
      {editing && (
        <ClassFormModal
          levels={levels}
          cls={editing}
          teachers={teachers}
          academicYears={academicYears}
          combinations={combinations}
          defaultAcademicYearId={currentYear?.id ?? null}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await handleSaveClass(payload, editing);
            if (ok) setEditing(null);
          }}
          onDelete={async () => {
            const ok = await handleDeleteClass(editing);
            if (ok) setEditing(null);
          }}
        />
      )}
      {detail && <ClassDetailDrawer cls={detail} onClose={() => setDetail(null)} />}
      {importOpen && (
        <ClassImportModal
          cls={importOpen}
          onClose={() => setImportOpen(null)}
          onImported={(count) => {
            const sectionId = importOpen?.sectionId;
            if (sectionId) {
              setStudentCounts((prev) => ({
                ...prev,
                [sectionId]: (prev[sectionId] ?? 0) + count
              }));
            }
            setList((prev) =>
              prev.map((item) =>
                item.id === importOpen.id
                  ? { ...item, studentCount: item.studentCount + count }
                  : item
              )
            );
          }}
        />
      )}
      {levelOpen && (
        <LevelFormModal
          onClose={() => setLevelOpen(false)}
          onSave={async (level) => {
            try {
              const created = await apiRequest<LevelRecord>("/levels", {
                method: "POST",
                body: JSON.stringify({ label: level }),
                auth: "school"
              });
              setLevels((current) => [...current, created]);
              toast.success(`${level} added`);
            } catch (error: any) {
              toast.error(error?.message ?? "Failed to add level");
              throw error;
            }
          }}
        />
      )}
    </AppLayout>
  );
}

type StudentLite = {
  id: string;
  student_school_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  student_id_number?: string | null;
  gender?: string | null;
  student_type?: string | null;
};

function ClassDetailDrawer({ cls, onClose }: { cls: ClassInfo; onClose: () => void }) {
  const [tab, setTab] = useState<"students" | "trend" | "reports">("students");
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [trend, setTrend] = useState<Array<{ day: string; rate: number }>>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    if (!cls.sectionId) return;
    setStudentsLoading(true);
    apiRequest<StudentLite[]>(`/students?section_id=${cls.sectionId}&limit=500`, { auth: "school" })
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [cls.sectionId]);

  useEffect(() => {
    if (!cls.sectionId) {
      setTrend([]);
      return;
    }

    let active = true;
    const loadTrend = async () => {
      setTrendLoading(true);
      try {
        const dates = getLastDates(14);
        const [sessionsByDate, recordsByDate] = await Promise.all([
          Promise.all(
            dates.map((date) =>
              apiRequest<ApiSession[]>(`/attendance/sessions?date=${date}&limit=500`, {
                auth: "school"
              }).catch(() => [])
            )
          ),
          Promise.all(
            dates.map((date) =>
              apiRequest<ApiRecord[]>(`/attendance/records?date=${date}&limit=5000`, {
                auth: "school"
              }).catch(() => [])
            )
          )
        ]);

        if (!active) return;

        const nextTrend = dates.map((date, idx) => {
          const sessions = sessionsByDate[idx].filter(
            (session) => session.section_id === cls.sectionId
          );
          const sessionIds = new Set(sessions.map((session) => session.id));
          const records = recordsByDate[idx].filter((record) => sessionIds.has(record.session_id));
          const total = records.length;
          const present = records.filter((record) => isPresentStatus(record.status)).length;
          const rate = total ? Math.round((present / total) * 100) : 0;
          return { day: formatDayLabel(date), rate };
        });

        setTrend(nextTrend);
      } catch (error: any) {
        if (active) toast.error(error?.message ?? "Failed to load attendance trend");
      } finally {
        if (active) setTrendLoading(false);
      }
    };

    loadTrend();
    return () => {
      active = false;
    };
  }, [cls.sectionId]);

  const fullName = (s: StudentLite) =>
    [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";

  const filtered = students.filter((s) => {
    const name = fullName(s).toLowerCase();
    const id = studentIdNumber(s).toLowerCase();
    const search = q.toLowerCase();
    return name.includes(search) || id.includes(search);
  });

  const hasTrend = trend.length > 0;
  const hasStudents = students.length > 0;
  const best = hasTrend ? trend.reduce((a, b) => a.rate > b.rate ? a : b) : null;
  const worst = hasTrend ? trend.reduce((a, b) => a.rate < b.rate ? a : b) : null;
  const avg = hasTrend ? Math.round(trend.reduce((s, x) => s + x.rate, 0) / trend.length) : 0;

  const roomLabel = cls.room || "—";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-card shadow-2xl flex flex-col h-screen">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="font-display font-bold text-lg">{cls.name} — {cls.level} Section {cls.section}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{cls.teacher} • {roomLabel}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex border-b border-border px-2">
          {(["students","trend","reports"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "students" ? "Students" : t === "trend" ? "Attendance Trend" : "Reports"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "students" && (
            <>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or Student ID Number…"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
              </div>

              {studentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground text-center">
                  {q ? `No students match "${q}"` : "No students enrolled in this class yet."}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-1">{filtered.length} student{filtered.length !== 1 ? "s" : ""}{q ? " found" : " enrolled"}</p>
                  {filtered.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40">
                      <Avatar name={fullName(s)} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{fullName(s)}</div>
                        <div className="text-xs text-muted-foreground font-mono">Student ID Number: {studentIdNumber(s)}</div>
                      </div>
                      {s.student_type && (
                        <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-md capitalize">
                          {s.student_type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === "trend" && (
            <>
              {trendLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-64 w-full" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ) : hasTrend ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip />
                        <Area type="monotone" dataKey="rate" stroke="#545f72" fill="#545f7233" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {best && <Mini label="Best Day" value={`${best.day} • ${best.rate}%`} />}
                    {worst && <Mini label="Worst Day" value={`${worst.day} • ${worst.rate}%`} />}
                    <Mini label="Average" value={`${avg}%`} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  No attendance trend data available yet.
                </div>
              )}
            </>
          )}
          {tab === "reports" && (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              {hasStudents
                ? `${students.length} students enrolled in ${cls.name}. Detailed reports coming soon.`
                : "No class reports available yet."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function ClassFormModal({
  cls,
  levels,
  teachers,
  academicYears,
  combinations,
  defaultAcademicYearId,
  saving,
  onClose,
  onSubmit,
  onDelete
}: {
  cls?: ClassInfo;
  levels: LevelRecord[];
  teachers: TeacherRecord[];
  academicYears: AcademicYearRecord[];
  combinations: CombinationRecord[];
  defaultAcademicYearId?: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ClassFormPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [levelId, setLevelId] = useState(cls?.levelId || levels[0]?.id || "");
  const [section, setSection] = useState(cls?.section || "A");
  const [teacherId, setTeacherId] = useState<string>(cls?.teacherId ?? "");
  const [room, setRoom] = useState(cls?.room ?? "");
  const [capacity, setCapacity] = useState(cls?.capacity || 40);
  const [confirmDel, setConfirmDel] = useState(false);
  const [academicYearId, setAcademicYearId] = useState<string>(
    cls?.academicYearId ?? defaultAcademicYearId ?? ""
  );
  const [combinationIds, setCombinationIds] = useState<string[]>(cls?.combinationIds ?? []);

  useEffect(() => {
    if (!cls && !academicYearId && defaultAcademicYearId) {
      setAcademicYearId(defaultAcademicYearId);
    }
  }, [cls, academicYearId, defaultAcademicYearId]);

  useEffect(() => {
    if (!levelId && levels[0]) {
      setLevelId(levels[0].id);
    }
  }, [levelId, levels]);

  const save = async () => {
    await onSubmit({
      levelId,
      section,
      teacherId: teacherId || null,
      room,
      capacity,
      academicYearId
      , combinationIds
    });
  };

  return (
    <div className="fixed inset-0 z-55 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">{cls ? "Edit Class" : "Add New Class"}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <Field label="Level">
            <select value={levelId} onChange={e => setLevelId(e.target.value)} className={inp}>
              <option value="">Select level</option>
              {levels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section"><input value={section} onChange={e => setSection(e.target.value.toUpperCase())} className={inp} /></Field>
          {academicYears.length > 0 ? (
            <Field label="Academic year" full>
              <select value={academicYearId} onChange={e => setAcademicYearId(e.target.value)} className={inp}>
                <option value="">Not set</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}{year.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="col-span-2 text-xs text-muted-foreground">
              No academic year found. Create one before importing students.
            </div>
          )}
          <Field label="Teacher" full>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={inp}>
              <option value="">Unassigned</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name ?? "Unnamed teacher"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room (optional)"><input value={room} onChange={e => setRoom(e.target.value)} className={inp} /></Field>
          <Field label="Capacity"><input type="number" min={1} max={MAX_CAPACITY} step={1} value={capacity} onChange={e => setCapacity(+e.target.value)} className={inp} /></Field>
          <Field label="Subject combinations" full>
            {combinations.length === 0 ? <p className="text-xs text-muted-foreground">No combinations created yet. Create MCB, PCB, or another combination from the subject management page.</p> : <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{combinations.map((combination) => <label key={combination.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={combinationIds.includes(combination.id)} onChange={(event) => setCombinationIds((current) => event.target.checked ? [...current, combination.id] : current.filter((id) => id !== combination.id))} /><span><b>{combination.code}</b> — {combination.name}</span></label>)}</div>}
          </Field>
        </div>
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-border">
          {cls && onDelete ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="inline-flex items-center gap-1.5 text-destructive text-sm font-semibold hover:underline"
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
            <button
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving…" : cls ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
      {cls && onDelete && (
        <ConfirmModal open={confirmDel} title="Delete Class" message={`Are you sure you want to delete ${cls.name}? This cannot be undone.`}
          danger confirmLabel="Delete" onConfirm={async () => { await onDelete(); }} onClose={() => setConfirmDel(false)} />
      )}
    </div>
  );
}

function ClassImportModal({
  cls,
  onClose,
  onImported
}: {
  cls: ClassInfo;
  onClose: () => void;
  onImported?: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<StudentImportParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [metaIssues, setMetaIssues] = useState<string[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [section, setSection] = useState<SectionRecord | null>(null);
  const [academicYear, setAcademicYear] = useState<AcademicYearRecord | null>(null);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      setMetaLoading(true);
      setMetaIssues([]);

      try {
        const [sections, years] = await Promise.all([
          apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
          apiRequest<AcademicYearRecord[]>("/academic-years?limit=50", { auth: "school" })
        ]);

        if (!active) return;

        const normalizedName = normalizeSectionKey(cls.fullName ?? cls.name);
        const matchedSection = cls.sectionId
          ? sections.find((item) => item.id === cls.sectionId)
          : sections.find(
            (item) => normalizeSectionKey(item.full_name ?? "") === normalizedName
          );
        const currentYear = years.find((year) => year.is_current) ?? years[0] ?? null;
        const issues: string[] = [];

        if (!matchedSection) {
          issues.push(`No matching section found for ${cls.name}.`);
        }

        if (!currentYear) {
          issues.push("No academic year found. Set a current academic year before importing.");
        }

        setSection(matchedSection ?? null);
        setAcademicYear(currentYear);
        setMetaIssues(issues);
      } catch (error: any) {
        if (!active) return;
        setMetaIssues([error?.message ?? "Failed to load class metadata."]);
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    };

    loadMeta();

    return () => {
      active = false;
    };
  }, [cls.name, cls.fullName, cls.sectionId]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setParseResult(null);
    setImportedCount(null);
    setServerIssues([]);

    if (!selected) {
      return;
    }

    setParsing(true);
    try {
      const result = await parseStudentImportFile(selected);
      setParseResult(result);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to parse file");
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const importFile = async () => {
    if (!parseResult?.validRows.length) {
      toast.error("No valid rows to import");
      return;
    }

    if (!section || !academicYear) {
      toast.error("Missing class assignment details");
      return;
    }

    setUploading(true);
    setServerIssues([]);

    try {
      const csvFile = makeStudentImportCsvFile(
        parseResult.validRows,
        `students-${cls.name.toLowerCase()}-${Date.now()}.csv`
      );
      const formData = new FormData();
      formData.append("file", csvFile);

      const query = new URLSearchParams({
        section_id: section.id,
        academic_year_id: academicYear.id
      });

      const result = await apiRequest<{ created: number }>(
        `/students/import?${query.toString()}`,
        {
          method: "POST",
          body: formData,
          auth: "school"
        }
      );

      const created = result?.created ?? parseResult.validRows.length;
      setImportedCount(created);
      toast.success(`${created} students imported to ${cls.name}`);
      onImported?.(created);
      setTimeout(() => onClose(), 1200);
    } catch (error: any) {
      const details = Array.isArray(error?.details) ? error.details : [];
      setServerIssues(details);
      toast.error(error?.message ?? "Import failed");
    } finally {
      setUploading(false);
    }
  };

  const hasHeaderIssues =
    parseResult?.issues.some((issue) => issue.type === "header") ?? false;
  const hasValidRows = (parseResult?.validRows.length ?? 0) > 0;
  const disableImport =
    !hasValidRows ||
    parsing ||
    uploading ||
    metaLoading ||
    metaIssues.length > 0 ||
    hasHeaderIssues;

  return (
    <div className="fixed inset-0 z-55 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Import Students</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            Import students into <span className="font-semibold text-foreground">{cls.name}</span>.
          </div>

          <div className="rounded-lg border border-border p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Section mapping</span>
              <span className="font-semibold">
                {metaLoading ? "Loading…" : section?.full_name ?? cls.fullName ?? cls.name ?? "Not found"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Academic year</span>
              <span className="font-semibold">
                {metaLoading ? "Loading…" : academicYear?.name ?? "Not set"}
              </span>
            </div>
          </div>

          {metaIssues.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-1">
              {metaIssues.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Upload Excel or CSV file</span>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className={inp}
            />
          </label>

          <button
            type="button"
            onClick={() => downloadStudentImportTemplate()}
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download Excel Template
          </button>

          {parsing && (
            <div className="text-xs text-muted-foreground">Parsing file…</div>
          )}

          {parseResult && (
            <div className="rounded-lg border border-border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rows detected</span>
                <span className="font-semibold">{parseResult.totalRows}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ready to import</span>
                <span className="font-semibold">{parseResult.validRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Issues found</span>
                <span className="font-semibold">{parseResult.issues.length}</span>
              </div>
            </div>
          )}

          {parseResult?.issues.length ? (
            <IssueList title="Validation & duplicate issues" issues={parseResult.issues} />
          ) : null}

          {serverIssues.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-1">
              {serverIssues.map((issue, index) => (
                <div key={`${issue}-${index}`}>{issue}</div>
              ))}
            </div>
          )}

          {importedCount !== null && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              Successfully imported {importedCount} students.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button
            onClick={importFile}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={disableImport}
          >
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueList({ title, issues }: { title: string; issues: StudentImportIssue[] }) {
  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="font-semibold mb-2">{title}</div>
      <div className="max-h-40 overflow-y-auto space-y-1 text-muted-foreground">
        {issues.map((issue, index) => (
          <div key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</div>
        ))}
      </div>
    </div>
  );
}

function LevelFormModal({ onClose, onSave }: { onClose: () => void; onSave: (level: string) => Promise<void>; }) {
  const [name, setName] = useState("");

  const save = async () => {
    const next = name.trim();
    if (!next) {
      toast.error("Level name is required");
      return;
    }

    try {
      await onSave(next);
      onClose();
    } catch {
      // error already surfaced by caller
    }
  };

  return (
    <div className="fixed inset-0 z-55 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Add Level createded</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Level Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Level 7" className={inp} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "col-span-2" : ""}`}><span className="text-xs font-semibold mb-1.5 block">{label}</span>{children}</label>;
}
