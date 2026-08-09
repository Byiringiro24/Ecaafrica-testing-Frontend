import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { X, Users } from "lucide-react";
import { toast } from "sonner";
import { teacherRouteGuard, getSchoolAuth } from "@/lib/schoolAuth";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/classes")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherClasses
});

type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
  class_teacher_id?: string | null;
};

type ClassRecord = {
  id: string;
  name: string;
  level: number;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: { name: string; full_name: string } | null;
};

type TeacherSectionSubject = {
  id: string;
  section_id: string;
};

type StudentCountResponse = {
  data: unknown[];
  meta?: { total?: number };
};

function TeacherClasses() {
  const auth = getSchoolAuth();
  const teacherId = auth?.user?.id;

  const [openClass, setOpenClass] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [classes, setClasses] = useState<Record<string, ClassRecord>>({});
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [sectionStudents, setSectionStudents] = useState<Record<string, StudentRecord[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClassesData = async () => {
      if (!teacherId) return;

      setLoading(true);
      try {
        // Fetch all sections
        const allSections = await apiRequest<SectionRecord[]>(
          "/sections?limit=500",
          { auth: "school" }
        );

        // Fetch teacher's assignments
        const teacherAssignments = await apiRequest<TeacherSectionSubject[]>(
          `/teacher-section-subjects?teacher_id=${teacherId}&limit=500`,
          { auth: "school" }
        );

        // Get section IDs from assignments
        const assignedSectionIds = new Set(
          teacherAssignments.map((t) => t.section_id)
        );

        // Filter sections: those assigned to teacher or where teacher is class teacher
        const teacherSections = allSections.filter(
          (s) => assignedSectionIds.has(s.id) || s.class_teacher_id === teacherId
        );

        setSections(teacherSections);

        // Fetch class details
        const classIds = new Set(teacherSections.map((s) => s.class_id));
        const classRecords = await apiRequest<ClassRecord[]>(
          "/classes?limit=500",
          { auth: "school" }
        );

        const classMap: Record<string, ClassRecord> = {};
        classRecords.forEach((c) => {
          if (classIds.has(c.id)) {
            classMap[c.id] = c;
          }
        });
        setClasses(classMap);

        // Fetch student counts for each section
        const counts: Record<string, number> = {};
        for (const section of teacherSections) {
          try {
            const response = await apiRequest<StudentCountResponse>(
              `/students?section_id=${section.id}&limit=1`,
              { auth: "school", returnMeta: true }
            );
            counts[section.id] = response.meta?.total ?? 0;
          } catch (err) {
            counts[section.id] = 0;
          }
        }
        setStudentCounts(counts);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load classes data");
      } finally {
        setLoading(false);
      }
    };

    loadClassesData();
  }, [teacherId]);

  const loadStudentsForSection = async (sectionId: string) => {
    if (sectionStudents[sectionId]) return;

    try {
      const students = await apiRequest<StudentRecord[]>(
        `/students?section_id=${sectionId}&limit=500`,
        { auth: "school" }
      );
      setSectionStudents((prev) => ({
        ...prev,
        [sectionId]: students
      }));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load students");
    }
  };

  const handleViewClass = (sectionId: string) => {
    setOpenClass(sectionId);
    loadStudentsForSection(sectionId);
  };

  return (
    <TeacherLayout title="My Classes" subtitle={`${sections.length} classes assigned`}>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : sections.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => {
            const classInfo = classes[section.class_id];
            const displayName = classInfo ? `${classInfo.name}${section.name}` : section.full_name;
            const students = sectionStudents[section.id] ?? [];
            const count = studentCounts[section.id] ?? 0;
            const att = 80 + (displayName.charCodeAt(0) % 15);
            const isClassTeacher = section.class_teacher_id === teacherId;

            return (
              <div key={section.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-display font-bold text-2xl">{displayName}</div>
                    <div className="text-xs text-muted-foreground">Assigned class</div>
                  </div>
                  {isClassTeacher && (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700">Class Teacher</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" /> {count} students
                </div>
                <div className="text-xs text-muted-foreground mb-1">Avg attendance this week</div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${att}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{att}% · last taken 2h ago</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleViewClass(section.id)} className="flex-1 h-8 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                    View Students
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No classes assigned yet.</p>
        </div>
      )}

      {openClass && (
        <ClassDrawer
          onClose={() => setOpenClass(null)}
          students={sectionStudents[openClass] ?? []}
          section={sections.find((s) => s.id === openClass)}
          classInfo={sections.find((s) => s.id === openClass) ? classes[sections.find((s) => s.id === openClass)!.class_id] : undefined}
          teacherId={teacherId}
        />
      )}
    </TeacherLayout>
  );
}

function ClassDrawer({
  onClose,
  students,
  section,
  classInfo,
  teacherId
}: {
  onClose: () => void;
  students: StudentRecord[];
  section?: SectionRecord;
  classInfo?: ClassRecord;
  teacherId?: string;
}) {
  const displayName = classInfo && section ? `${classInfo.name}${section.name}` : section?.full_name ?? "Class";
  const isClassTeacher = section?.class_teacher_id === teacherId;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 bg-background z-10 px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{isClassTeacher ? "Class Teacher" : "Assigned class"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Reg #</th></tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((s, i) => (
                    <tr key={s.id} className={`border-t border-border ${i % 2 ? "bg-gray-50" : ""}`}>
                      <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                      <td className="p-3 text-muted-foreground">{s.student_id_number ?? "--"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-muted-foreground">No students in this class</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </>
  );
}
