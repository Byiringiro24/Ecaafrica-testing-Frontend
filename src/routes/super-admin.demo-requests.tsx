import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Trash2, CheckCircle2, Clock3, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { getDemoRequests, updateDemoRequestStatus, deleteDemoRequest, DemoRequest, DemoRequestStatus } from "@/lib/demoRequests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super-admin/demo-requests")({ component: DemoRequestsPage });

const STATUS_OPTIONS: Array<DemoRequestStatus | "All"> = ["All", "Pending", "Contacted", "Scheduled", "Completed"];

function DemoRequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DemoRequestStatus | "All">("All");
  const [requests, setRequests] = useState<DemoRequest[]>([]);

  useEffect(() => {
    setRequests(getDemoRequests());
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus = status === "All" || request.status === status;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        request.schoolName.toLowerCase().includes(query) ||
        request.contactName.toLowerCase().includes(query) ||
        request.email.toLowerCase().includes(query) ||
        request.phone.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, status]);

  const handleStatusChange = (id: string, nextStatus: DemoRequestStatus) => {
    const updated = updateDemoRequestStatus(id, nextStatus);
    setRequests(updated);
    toast.success("Demo request status updated.");
  };

  const handleDelete = (id: string) => {
    const updated = deleteDemoRequest(id);
    setRequests(updated);
    toast.success("Demo request deleted.");
  };

  return (
    <SuperAdminLayout
      title="Demo Requests"
      subtitle="Review and manage demo requests from schools."
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "Demo Requests" },
          ]}
        />
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All demo requests</h2>
                <p className="mt-1 text-sm text-muted-foreground">Track status, search by school, and update requests quickly.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by school, contact, email or phone"
                  className="max-w-sm"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DemoRequestStatus | "All")}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <div>
                Demo requests are stored locally and sent to the backend when the API is available.
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-950/90 text-left text-xs uppercase tracking-[0.16em] text-slate-300">
              <tr>
                <th className="px-4 py-4">School</th>
                <th className="px-4 py-4">Contact</th>
                <th className="px-4 py-4">Request Date</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No demo requests found. Encourage schools to submit a request via the public demo page.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{request.schoolName}</div>
                      <div className="text-xs text-muted-foreground">{request.country}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{request.contactName}</div>
                      <div className="text-xs text-muted-foreground">{request.email}</div>
                      <div className="text-xs text-muted-foreground">{request.phone}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        request.status === "Pending" ? "bg-amber-100 text-amber-800" :
                        request.status === "Contacted" ? "bg-sky-100 text-sky-800" :
                        request.status === "Scheduled" ? "bg-emerald-100 text-emerald-800" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(["Pending", "Contacted", "Scheduled", "Completed"] as DemoRequestStatus[]).map((nextStatus) => (
                          <button
                            key={nextStatus}
                            type="button"
                            onClick={() => handleStatusChange(request.id, nextStatus)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {nextStatus}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(request.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-destructive bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
