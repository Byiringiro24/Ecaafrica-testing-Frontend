/** DOS — Teaching staff view */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/staff")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosStaffPage,
});

type StaffRecord = { id: string; name: string; email?: string | null; role: string };

function DosStaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<StaffRecord[]>("/staff?limit=500", { auth: "school" })
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setStaff(list.filter(s => ["teacher", "director_of_studies", "director_of_discipline"].includes(s.role?.toLowerCase() ?? "")));
      })
      .catch(e => toast.error(e?.message ?? "Failed to load staff"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DosLayout title="Teaching Staff" subtitle="View academic staff and their roles">
      {loading ? <Skeleton className="h-64" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Name", "Email", "Role"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No academic staff found.</td></tr>
              ) : staff.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="px-4 py-3 text-xs capitalize">{s.role.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DosLayout>
  );
}
