import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { academicManagementRouteGuard } from "@/lib/schoolAuth";
import {
  createTerm,
  listAcademicYears,
  listTerms,
  updateTerm,
  type AcademicYearOption,
  type TermRecord,
} from "@/lib/report-cards-api";

export const Route = createFileRoute("/exams/terms")({
  beforeLoad: ({ location }) => academicManagementRouteGuard(location),
  component: TermsPage,
});

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary";

function TermsPage() {
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [yearId, setYearId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);

  const todayValue = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const [termList, yearList] = await Promise.all([listTerms(), listAcademicYears()]);
        setTerms(termList as TermRecord[]);
        setYears(yearList);
        const currentYear = yearList.find((year) => year.is_current);
        if (currentYear) setYearId(currentYear.id);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load terms");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const yearName = (id: string) => years.find((year) => year.id === id)?.name ?? "—";

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setIsCurrent(true);
  };

  const handleEdit = (term: TermRecord) => {
    setEditingId(term.id);
    setName(term.name);
    setYearId(term.academic_year_id);
    setStartDate(term.start_date?.slice(0, 10) ?? "");
    setEndDate(term.end_date?.slice(0, 10) ?? "");
    setIsCurrent(term.is_current);
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await updateTerm(id, { is_current: true });
      setTerms((prev) => prev.map((term) => ({ ...term, is_current: term.id === id })));
      toast.success("Term set as current");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update term");
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !yearId || !startDate || !endDate) {
      toast.error("Name, academic year, start date, and end date are required");
      return;
    }

    if (startDate > todayValue) {
      toast.error("Start date cannot be in the future");
      return;
    }

    if (endDate < todayValue) {
      toast.error("End date cannot be in the past");
      return;
    }

    const payload = {
      name: name.trim(),
      academic_year_id: yearId,
      start_date: startDate,
      end_date: endDate,
      is_current: isCurrent,
    };

    try {
      setSaving(true);
      if (editingId) {
        const updated = await updateTerm(editingId, payload);
        setTerms((prev) =>
          prev.map((term) =>
            term.id === editingId ? { ...term, ...(updated as TermRecord) } : term
          )
        );
        toast.success("Term updated");
      } else {
        const created = await createTerm(payload);
        setTerms((prev) => {
          const cleared = payload.is_current
            ? prev.map((term) =>
                term.academic_year_id === payload.academic_year_id
                  ? { ...term, is_current: false }
                  : term
              )
            : prev;
          return [...cleared, created as TermRecord];
        });
        toast.success("Term created");
      }
      resetForm();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save term");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create terms for the academic year and set the active one. Terms are used by report cards,
        exams, attendance, and fees.
      </p>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">
              {editingId ? "Update Term" : "Add Term"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {editingId
                ? "Edit the term details below."
                : "Create a new term for a specific academic year."}
            </p>
          </div>
          {editingId && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-semibold text-primary sm:inline">
                Editing {name || "term"}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Term name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="e.g. Term 1"
            />
          </Field>
          <Field label="Academic year">
            <select
              value={yearId}
              onChange={(event) => setYearId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select academic year</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              max={todayValue}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={endDate}
              min={startDate || todayValue}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
          <span className="text-sm font-medium">Set as current term</span>
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(event) => setIsCurrent(event.target.checked)}
            className="h-5 w-9 accent-primary"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editingId ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {editingId ? "Update term" : "Add term"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Terms</h3>
            <p className="text-sm text-muted-foreground">
              Manage your school terms across academic years.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{terms.length} records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Academic year</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{term.name}</td>
                    <td className="px-3 py-2">{yearName(term.academic_year_id)}</td>
                    <td className="px-3 py-2">{term.start_date?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2">{term.end_date?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2">
                      {term.is_current ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Current
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!term.is_current && (
                        <button
                          type="button"
                          onClick={() => handleSetCurrent(term.id)}
                          className="mr-3 text-xs font-semibold text-primary hover:underline"
                        >
                          Set current
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(term)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {terms.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={6} className="px-3 py-3 text-xs text-muted-foreground">
                      No terms yet. Create one using the form above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
