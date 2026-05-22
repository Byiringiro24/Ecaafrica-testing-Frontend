import { ChangeEvent, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus, MoreVertical, Phone, Download, Upload } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { STUDENTS, CLASSES } from "@/lib/mockData";
import { StudentRegistrationModal } from "@/components/modals/StudentRegistrationModal";
import { toast } from "sonner";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [open, setOpen] = useState(false);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    toast.success(`Selected ${file.name} for import`);
    event.target.value = "";
  };

  const filtered = useMemo(() => STUDENTS.filter(s =>
    (classFilter === "All" || s.class === classFilter) &&
    (search === "" || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()))
  ), [search, classFilter]);

  return (
    <AppLayout title="Student Management" subtitle={`${STUDENTS.length} students enrolled`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Classes</option>
          {CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <a
          href="/students-import-template.csv"
          download="ecareafrica-students-template.csv"
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Download Excel Template
        </a>
        <label className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted cursor-pointer">
          <Upload className="h-4 w-4" /> Import from Excel
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleImport}
            className="hidden"
          />
        </label>
        <button
          onClick={() => setOpen(true)}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" /> Register New Student
        </button>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(s => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <Avatar name={s.name} size="lg" />
              <button className="rounded-md p-1.5 hover:bg-muted text-muted-foreground"><MoreVertical className="h-4 w-4" /></button>
            </div>
            <h3 className="font-display font-bold mt-3 truncate">{s.name}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.id}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{s.class}</span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                s.attendanceRate >= 85 ? "bg-success/15 text-success" :
                s.attendanceRate >= 70 ? "bg-amber-100 text-amber-700" :
                "bg-destructive/15 text-destructive"
              }`}>
                {s.attendanceRate}% attendance
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{s.parentPhone}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">No students match your search.</div>
        )}
      </div>

      <StudentRegistrationModal open={open} onClose={() => setOpen(false)} />
    </AppLayout>
  );
}
