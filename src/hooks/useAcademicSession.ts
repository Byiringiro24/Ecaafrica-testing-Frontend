import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type AcademicYear = { id: string; name: string; is_current?: boolean };
type Term = { id: string; name: string; academic_year_id: string; is_current?: boolean };

export type AcademicSession = {
  academicYear: AcademicYear | null;
  term: Term | null;
  label: string | null;
};

/** Current academic year + term, used for finance headers and invoice periods. */
export function useAcademicSession(): AcademicSession {
  const [session, setSession] = useState<AcademicSession>({
    academicYear: null,
    term: null,
    label: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [years, terms] = await Promise.all([
          apiRequest<AcademicYear[]>("/academic-years?limit=100", { auth: "school" }),
          apiRequest<Term[]>("/terms?limit=100", { auth: "school" }),
        ]);
        if (cancelled) return;

        const academicYear = years.find((y) => y.is_current) ?? years[0] ?? null;
        const term =
          terms.find((t) => t.is_current && t.academic_year_id === academicYear?.id) ??
          terms.find((t) => t.is_current) ??
          null;

        setSession({
          academicYear,
          term,
          label: [academicYear?.name, term?.name].filter(Boolean).join(" · ") || null,
        });
      } catch {
        if (!cancelled) setSession({ academicYear: null, term: null, label: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
