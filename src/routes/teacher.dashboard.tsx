import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, Users, CheckCircle2, ClipboardCheck, FileText,
  MessageSquare, Calendar, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { teacherRouteGuard, getSchoolAuth } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getTeacherAssignments, type TeacherAssignmentPair } from "@/lib/exams-api";

export const Route = createFileRoute("/teacher/dashboard")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherDashboard
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
};

type StudentCountResponse = {
  data: unknown[];
  meta?: { total?: number };
};

type SubjectRecord = {
  id: string;
  name: string;
  code?: string | null;
};

function TeacherDashboard() {
  const auth = getSchoolAuth();
  const teacherId = auth?.user?.id;
  const currentUser = useCurrentUser();

  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [classes, setClasses] = useState<Record<string, ClassRecord>>({});
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeacherAssignmentPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!teacherId) return;

      setLoading(true);
      try {
        // Fetch all sections
        const allSections = await apiRequest<SectionRecord[]>(
          "/sections?limit=500",
          { auth: "school" }
        );

        // Admin-assigned teaching subjects live in teacher_section_subjects
        const assignmentData = await getTeacherAssignments();
        setSubjects(assignmentData.subjects ?? []);
        setTeachingAssignments(assignmentData.assignments ?? []);

        const assignedSectionIds = new Set(
          assignmentData.assignments.map((item) => item.section_id)
        );

        // Include sections from subject assignments and class-teacher role
        const assignmentSectionIds = new Set(
          (assignmentData.sections ?? []).map((section) => section.id)
        );
        const teacherSections = allSections.filter(
          (s) =>
            assignedSectionIds.has(s.id) ||
            assignmentSectionIds.has(s.id) ||
            s.class_teacher_id === teacherId
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
        toast.error(error?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [teacherId]);

  const totalStudents = Object.values(studentCounts).reduce((sum, count) => sum + count, 0);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const subjectCount = subjects.length;

  const displayName = currentUser?.name
    ? currentUser.name.split(" ").slice(0, 2).join(" ")
    : auth?.user?.name
      ? auth.user.name.split(" ").slice(0, 2).join(" ")
      : "Teacher";

  return (
    <TeacherLayout title={`${greeting}, ${displayName}`} subtitle={today}>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard label="My Classes" value={sections.length} icon={<BookOpen className="h-5 w-5" />} trend={`${sections.length} active`} tone="primary" />
            <StatCard label="Students I Teach" value={totalStudents} icon={<Users className="h-5 w-5" />} trend={`across ${sections.length} classes`} tone="primary" />
            <StatCard label="Subjects I Teach" value={subjectCount} icon={<FileText className="h-5 w-5" />} trend={`${subjectCount} assigned`} tone="secondary" />
            <StatCard label="Present Today" value="92%" icon={<CheckCircle2 className="h-5 w-5" />} trend="↑ 3% vs yesterday" tone="success" />
          </>
        )}
      </div>

      <div className="grid gap-5 mt-6">
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/teacher/attendance" className="rounded-lg bg-primary text-primary-foreground p-4 hover:bg-primary/90 transition flex flex-col items-start gap-2">
                <ClipboardCheck className="h-5 w-5" />
                <span className="font-semibold text-sm">Mark class attendance</span>
              </Link>
              <Link to="/teacher/exams" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Record Marks</span>
              </Link>
              <Link to="/teacher/messages" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Communicate with parents</span>
              </Link>
              <Link to="/teacher/schedule" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">My Timetable</span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-4">Subjects I Teach</h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : teachingAssignments.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Assigned by your school admin ({subjectCount} subject{subjectCount === 1 ? "" : "s"})
                </div>
                <div className="flex flex-wrap gap-2">
                  {teachingAssignments.map((item) => (
                    <span
                      key={`${item.section_id}-${item.subject_id}`}
                      className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium"
                    >
                      {item.subject.name} — {item.section.full_name}
                    </span>
                  ))}
                </div>
              </div>
            ) : subjects.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Assigned subjects</div>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => (
                    <span key={subject.id} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">
                      {subject.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No assigned subjects yet. Ask your school admin to add class/subject teaching assignments.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-4">My Classes</h3>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : sections.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sections.map((section) => {
                  const classInfo = classes[section.class_id];
                  const displayName = classInfo ? `${classInfo.name}${section.name}` : section.full_name;
                  const count = studentCounts[section.id] ?? 0;
                  const att = 85 + (displayName.charCodeAt(0) % 10);
                  const isClassTeacher = section.class_teacher_id === teacherId;

                  return (
                    <div key={section.id} className="rounded-lg border border-border p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="font-display font-bold text-xl">{displayName}</div>
                        {isClassTeacher && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">CT</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{count > 0 ? "Assigned class" : "No students"}</div>
                      <div className="text-[11px] mt-2">{count} students · {att}% attendance</div>
                      <Link to="/teacher/classes" className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 hover:underline">View Class <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No classes assigned yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
