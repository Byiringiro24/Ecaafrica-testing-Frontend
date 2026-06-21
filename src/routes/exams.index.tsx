import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck, Send, Award, BookOpen, TrendingUp, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  listAdminExams,
  isPendingReview,
  isPublished,
  examTypeLabel,
  type AdminExam,
} from "@/lib/exams-admin-api";

export const Route = createFileRoute("/exams/")({
  component: ExamsOverviewPage,
});

const PIE_COLORS = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"];

function ExamsOverviewPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await listAdminExams({ limit: 500 });
      setExams(data);
    } catch (error) {
      toast.error("Failed to load exams overview");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const pending = useMemo(() => exams.filter(isPendingReview), [exams]);
  const published = useMemo(() => exams.filter(isPublished), [exams]);
  const scheduled = useMemo(
    () => exams.filter((e) => e.status === "scheduled" && (e.marked_count ?? 0) === 0),
    [exams]
  );

  const totalMarked = useMemo(
    () => exams.reduce((sum, e) => sum + (e.marked_count ?? 0), 0),
    [exams]
  );

  const avgPassRate = useMemo(() => {
    const withRate = published.filter((e) => e.pass_rate);
    if (withRate.length === 0) return null;
    const total = withRate.reduce((s, e) => s + parseFloat(e.pass_rate ?? "0"), 0);
    return Math.round(total / withRate.length);
  }, [published]);

  const statusChart = useMemo(() => {
    const counts = {
      "Awaiting Review": pending.length,
      Published: published.length,
      Scheduled: scheduled.length,
      "In Progress": exams.filter((e) => e.status === "ongoing" && !isPendingReview(e)).length,
    };
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [exams, pending, published, scheduled]);

  const typeChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const exam of exams) {
      const label = examTypeLabel(exam.type);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [exams]);

  const classPerformance = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const exam of published) {
      if (!exam.section?.full_name || !exam.average_score) continue;
      const key = exam.section.full_name;
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += parseFloat(exam.average_score);
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
        average: parseFloat((total / count).toFixed(1)),
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 8);
  }, [published]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading overview…</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard
          label="Total Exams"
          value={exams.length}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting Review"
          value={pending.length}
          tone="warning"
          icon={<ClipboardCheck className="h-5 w-5" />}
          trend={pending.length > 0 ? "Action required" : undefined}
        />
        <StatCard
          label="Published"
          value={published.length}
          tone="success"
          icon={<Send className="h-5 w-5" />}
        />
        <StatCard
          label="Results Recorded"
          value={totalMarked}
          icon={<Award className="h-5 w-5" />}
        />
        <StatCard
          label="Avg Pass Rate"
          value={avgPassRate !== null ? `${avgPassRate}%` : "—"}
          tone="primary"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-900">
              {pending.length} exam{pending.length !== 1 ? "s" : ""} waiting for your review
            </div>
            <p className="text-sm text-amber-800 mt-0.5">
              Teachers have submitted marks. Review and publish so parents can view grades.
            </p>
          </div>
          <Link
            to="/exams/review"
            className="shrink-0 h-9 px-4 rounded-md bg-amber-600 text-white text-sm font-semibold inline-flex items-center hover:bg-amber-700"
          >
            Review Now
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-4">Exam Status Breakdown</h3>
          {statusChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No exam data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-4">Exams by Type</h3>
          {typeChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No exam data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b5998" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {classPerformance.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm mb-6">
          <h3 className="font-display font-bold mb-4">Class Average Scores (Published Exams)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="average" fill="#22C55E" radius={[0, 4, 4, 0]} name="Average Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold">Recent Submissions</h3>
            <Link to="/exams/review" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No pending submissions</div>
          ) : (
            <div className="divide-y divide-border">
              {pending.slice(0, 5).map((exam) => (
                <div key={exam.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{exam.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {exam.section?.full_name} · {exam.subject?.name} · {exam.marked_count} marked
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Review
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold">Recently Published</h3>
            <Link to="/exams/published" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {published.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No published results yet</div>
          ) : (
            <div className="divide-y divide-border">
              {published.slice(0, 5).map((exam) => (
                <div key={exam.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{exam.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {exam.section?.full_name} · Avg: {exam.average_score ?? "—"} · Pass: {exam.pass_rate ?? "—"}%
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-800">
                    Published
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
