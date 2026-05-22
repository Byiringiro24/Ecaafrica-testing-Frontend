import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen, Users, CheckCircle2, ClipboardCheck, FileText,
  MessageSquare, Calendar, ArrowRight,
} from "lucide-react";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { TEACHER_ME, studentsInClass } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/dashboard")({ component: TeacherDashboard });

function TeacherDashboard() {
  const totalStudents = TEACHER_ME.classes.reduce((sum, c) => sum + studentsInClass(c).length, 0);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <TeacherLayout title={`${greeting}, ${TEACHER_ME.name.split(" ").slice(0, 2).join(" ")}`} subtitle={today}>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="My Classes" value={TEACHER_ME.classes.length} icon={<BookOpen className="h-5 w-5" />} trend="6 active" tone="primary" />
        <StatCard label="Students I Teach" value={totalStudents} icon={<Users className="h-5 w-5" />} trend={`across ${TEACHER_ME.classes.length} classes`} tone="primary" />
        <StatCard label="Present Today" value="92%" icon={<CheckCircle2 className="h-5 w-5" />} trend="↑ 3% vs yesterday" tone="success" />
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
                <span className="font-semibold text-sm">Take Attendance</span>
              </Link>
              <Link to="/teacher/exams" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Record Marks</span>
              </Link>
              <Link to="/teacher/messages" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Send Message</span>
              </Link>
              <Link to="/teacher/schedule" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">My Timetable</span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-4">My Classes</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEACHER_ME.classes.map((cls) => {
                const count = studentsInClass(cls).length;
                const att = 85 + (cls.charCodeAt(1) % 10);
                return (
                  <div key={cls} className="rounded-lg border border-border p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div className="font-display font-bold text-xl">{cls}</div>
                      {cls === TEACHER_ME.classTeacher && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">CT</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{TEACHER_ME.subject}</div>
                    <div className="text-[11px] mt-2">{count} students · {att}% attendance</div>
                    <Link to="/teacher/classes" className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 hover:underline">View Class <ArrowRight className="h-3 w-3" /></Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
