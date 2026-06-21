import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, Cell,
} from "recharts";
import { ExamFilters } from "@/components/exams/ExamFilters";
import {
  listAdminExams,
  getFilterOptions,
  isPublished,
  type AdminExam,
  type SectionOption,
  type SubjectOption,
} from "@/lib/exams-admin-api";

export const Route = createFileRoute("/exams/analytics")({
  component: ExamsAnalyticsPage,
});

const GRADE_COLORS: Record<string, string> = {
  A: "#22C55E",
  B: "#3B82F6",
  C: "#F59E0B",
  D: "#F97316",
  F: "#EF4444",
};

function ExamsAnalyticsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFilterOptions().then((opts) => {
      setSections(opts.sections);
      setSubjects(opts.subjects);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadExams();
  }, [sectionId, subjectId]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await listAdminExams({
        status: "completed",
        section_id: sectionId || undefined,
        subject_id: subjectId || undefined,
        limit: 500,
      });
      setExams(data.filter(isPublished));
    } catch (error) {
      toast.error("Failed to load analytics data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const passRateByClass = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const exam of exams) {
      if (!exam.section?.full_name || !exam.pass_rate) continue;
      const entry = map.get(exam.section.full_name) ?? { total: 0, count: 0 };
      entry.total += parseFloat(exam.pass_rate);
      entry.count += 1;
      map.set(exam.section.full_name, entry);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({
        name: name.length > 16 ? `${name.slice(0, 14)}…` : name,
        passRate: Math.round(total / count),
      }))
      .sort((a, b) => b.passRate - a.passRate);
  }, [exams]);

  const passRateBySubject = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const exam of exams) {
      if (!exam.subject?.name || !exam.pass_rate) continue;
      const entry = map.get(exam.subject.name) ?? { total: 0, count: 0 };
      entry.total += parseFloat(exam.pass_rate);
      entry.count += 1;
      map.set(exam.subject.name, entry);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({
        name: name.length > 14 ? `${name.slice(0, 12)}…` : name,
        passRate: Math.round(total / count),
      }))
      .sort((a, b) => b.passRate - a.passRate)
      .slice(0, 10);
  }, [exams]);

  const scoreTrend = useMemo(() => {
    return exams
      .filter((e) => e.exam_date && e.average_score)
      .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())
      .slice(-12)
      .map((e) => ({
        date: new Date(e.exam_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        label: e.name.length > 20 ? `${e.name.slice(0, 18)}…` : e.name,
        average: parseFloat(e.average_score!),
        passRate: e.pass_rate ? parseFloat(e.pass_rate) : 0,
      }));
  }, [exams]);

  const gradeDistribution = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const exam of exams) {
      if (!exam.average_score || !exam.max_marks) continue;
      const pct = (parseFloat(exam.average_score) / parseFloat(exam.max_marks)) * 100;
      if (pct >= 80) counts.A += exam.marked_count ?? 0;
      else if (pct >= 70) counts.B += exam.marked_count ?? 0;
      else if (pct >= 60) counts.C += exam.marked_count ?? 0;
      else if (pct >= 50) counts.D += exam.marked_count ?? 0;
      else counts.F += exam.marked_count ?? 0;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([grade, count]) => ({ grade, count }));
  }, [exams]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading analytics…</div>;
  }

  if (exams.length === 0) {
    return (
      <div>
        <ExamFilters
          sections={sections}
          subjects={subjects}
          sectionId={sectionId}
          subjectId={subjectId}
          onSectionChange={setSectionId}
          onSubjectChange={setSubjectId}
        />
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No published exam data to analyze yet. Publish results to see performance charts.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          School-wide performance insights from published exam results.
        </p>
      </div>

      <ExamFilters
        sections={sections}
        subjects={subjects}
        sectionId={sectionId}
        subjectId={subjectId}
        onSectionChange={setSectionId}
        onSubjectChange={setSubjectId}
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-4">Pass Rate by Class</h3>
          {passRateByClass.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={passRateByClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Pass Rate"]} />
                <Bar dataKey="passRate" fill="#3b5998" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-4">Pass Rate by Subject</h3>
          {passRateBySubject.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={passRateBySubject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Pass Rate"]} />
                <Bar dataKey="passRate" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {scoreTrend.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm mb-5">
          <h3 className="font-display font-bold mb-4">Score & Pass Rate Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
              />
              <Legend />
              <Line type="monotone" dataKey="average" stroke="#3B82F6" name="Avg Score" strokeWidth={2} dot />
              <Line type="monotone" dataKey="passRate" stroke="#22C55E" name="Pass Rate %" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {gradeDistribution.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-4">Estimated Grade Distribution (by exam averages)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                {gradeDistribution.map((entry) => (
                  <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] ?? "#64748B"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
