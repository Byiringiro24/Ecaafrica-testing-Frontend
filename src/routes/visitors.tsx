import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, Plus, X, Search, LogOut, Eye, ChevronRight, ChevronLeft, Calendar, CheckCircle2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { SaPhoneInput } from "@/components/super-admin/ui";
import { useSchoolCountryName } from "@/hooks/useSchoolCountry";

export const Route = createFileRoute("/visitors")({ component: VisitorsPage });

const TABS = ["Active Visitors", "Scheduled", "History", "Logs"] as const;
type Tab = typeof TABS[number];

type ApiVisitorType = "parent_guardian" | "organization";
type ApiVisitorPurpose = "parent_visit" | "official_business" | "delivery" | "inspection" | "other";
type ApiAppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

type ApiVisitor = {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  organization?: string | null;
  visitor_type: ApiVisitorType;
  created_at: string;
};

type ApiVisitorSummary = Pick<ApiVisitor, "id" | "full_name" | "visitor_type"> & {
  phone?: string | null;
  national_id?: string | null;
  organization?: string | null;
};

type ApiAppointment = {
  id: string;
  visitor_id: string;
  student_id?: string | null;
  host_id?: string | null;
  purpose?: ApiVisitorPurpose | null;
  appointment_at?: string | null;
  expected_duration_min?: number | null;
  notes?: string | null;
  status?: ApiAppointmentStatus;
  visitor?: ApiVisitorSummary | null;
  student?: { id: string; first_name: string; last_name: string } | null;
  host?: { id: string; name?: string | null; email?: string | null } | null;
};

type ApiVisit = {
  id: string;
  visitor_id: string;
  appointment_id?: string | null;
  student_id?: string | null;
  host_id?: string | null;
  purpose?: string | null;
  checked_in_at?: string | null;
  expected_out_at?: string | null;
  checked_out_at?: string | null;
  checked_in_by?: string | null;
  checked_out_by?: string | null;
  notes?: string | null;
  badge_printed?: boolean | null;
  sms_sent_host?: boolean | null;
  visitor?: ApiVisitorSummary | null;
  appointment?: { id: string; purpose?: ApiVisitorPurpose | null; appointment_at?: string | null } | null;
  student?: { id: string; first_name: string; last_name: string } | null;
};

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  current_section?: { full_name: string } | null;
};

type ApiUser = {
  id: string;
  name?: string | null;
  role?: string | null;
};

type VisitRow = {
  visitId: string;
  visitorId: string;
  appointmentId?: string | null;
  name: string;
  nationalId: string;
  phone: string;
  organization: string;
  purpose: string;
  host: string;
  visitDate: string;
  checkinTime: string;
  checkoutTime?: string;
  checkinAt?: string | null;
  checkoutAt?: string | null;
  checkinBy?: string;
  checkoutBy?: string;
  status: "on-campus" | "checked-out";
  notes?: string;
};

type AppointmentRow = {
  appointmentId: string;
  visitorId: string;
  studentId?: string | null;
  hostId?: string | null;
  name: string;
  organization: string;
  host: string;
  purpose: string;
  purposeValue?: ApiVisitorPurpose | null;
  expectedDurationMin?: number | null;
  appointmentDate: string;
  appointmentTime: string;
  status: ApiAppointmentStatus;
};

type RegisterPayload = {
  fullName: string;
  nationalId: string;
  phone: string;
  organization: string;
  visitorType: ApiVisitorType;
  studentId?: string | null;
  hostId?: string | null;
  purpose: ApiVisitorPurpose;
  appointmentAt: string;
  expectedDurationMin: number;
  notes?: string;
};

const VISITOR_TYPE_OPTIONS = [
  { label: "Parent/Guardian", value: "parent_guardian" },
  { label: "Organization", value: "organization" }
] as const;

const PURPOSE_OPTIONS = [
  { label: "Parent Visit", value: "parent_visit" },
  { label: "Official Business", value: "official_business" },
  { label: "Delivery", value: "delivery" },
  { label: "Inspection", value: "inspection" },
  { label: "Other", value: "other" }
] as const;

const PURPOSE_LABEL: Record<ApiVisitorPurpose, string> = {
  parent_visit: "Parent Visit",
  official_business: "Official Business",
  delivery: "Delivery",
  inspection: "Inspection",
  other: "Other"
};

const hostTitleFor = (role?: string | null) => {
  if (!role) return "";
  const normalized = role.toLowerCase();
  if (normalized.includes("admin")) return "Head Teacher";
  if (normalized.includes("teacher")) return "Teacher";
  if (normalized.includes("hod")) return "HOD";
  return "";
};

const hostDisplayName = (staff?: ApiUser | null) => {
  if (!staff?.name) return "—";
  const title = hostTitleFor(staff.role);
  return title ? `${title} ${staff.name}` : staff.name;
};

const studentLabel = (student: ApiStudent) => {
  const name = `${student.first_name} ${student.last_name}`.trim();
  const section = student.current_section?.full_name ?? "—";
  return `${name} - ${section}`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const toPurposeLabel = (value?: string | null) => {
  if (!value) return "Other";
  if (value in PURPOSE_LABEL) return PURPOSE_LABEL[value as ApiVisitorPurpose];
  return value;
};

const buildOrganizationLabel = (
  visitor?: ApiVisitor | ApiVisitorSummary | null,
  student?: { first_name: string; last_name: string } | null
) => {
  if (!visitor) return "—";
  if (visitor.visitor_type === "parent_guardian" && student) {
    const name = `${student.first_name} ${student.last_name}`.trim();
    return name ? `Parent of ${name}` : "Parent/Guardian";
  }
  return visitor.organization ?? "—";
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isWithinDays = (value: Date, days: number) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return value >= start;
};

const durationToMinutes = (label: string) => {
  switch (label) {
    case "30 min":
      return 30;
    case "1 hr":
      return 60;
    case "2 hrs":
      return 120;
    case "Half day":
      return 240;
    case "Full day":
      return 480;
    default:
      return 60;
  }
};

function VisitorsPage() {
  const [tab, setTab] = useState<Tab>("Active Visitors");
  const [visitors, setVisitors] = useState<ApiVisitor[]>([]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [visits, setVisits] = useState<ApiVisit[]>([]);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [hosts, setHosts] = useState<ApiUser[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<VisitRow | null>(null);
  const [viewing, setViewing] = useState<VisitRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const schoolCountry = useSchoolCountryName();

  const loadVisitorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitorData, appointmentData, visitData, studentData, hostData] = await Promise.all([
        apiRequest<ApiVisitor[]>("/visitors?limit=1000", { auth: "school" }),
        apiRequest<ApiAppointment[]>("/visitor-appointments?limit=1000", { auth: "school" }),
        apiRequest<ApiVisit[]>("/visitor-visits?limit=1000", { auth: "school" }),
        apiRequest<ApiStudent[]>("/students?limit=1000", { auth: "school" }),
        apiRequest<ApiUser[]>("/users?limit=300", { auth: "school" })
      ]);
      setVisitors(Array.isArray(visitorData) ? visitorData : []);
      setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
      setVisits(Array.isArray(visitData) ? visitData : []);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setHosts(Array.isArray(hostData) ? hostData : []);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load visitor data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVisitorData();
  }, []);

  const visitorMap = useMemo(
    () => new Map(visitors.map((visitor) => [visitor.id, visitor])),
    [visitors]
  );
  const hostMap = useMemo(
    () => new Map(hosts.map((host) => [host.id, host])),
    [hosts]
  );
  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const visitRows = useMemo<VisitRow[]>(() => {
    return visits.map((visit) => {
      const visitorDetails = visitorMap.get(visit.visitor_id) ?? null;
      const visitor = visitorDetails ?? visit.visitor ?? null;
      const student =
        visit.student ?? (visit.student_id ? studentMap.get(visit.student_id) ?? null : null);
      const host = visit.host_id ? hostMap.get(visit.host_id) ?? null : null;
      const checkinBy = visit.checked_in_by
        ? hostDisplayName(hostMap.get(visit.checked_in_by) ?? null)
        : "—";
      const checkoutBy = visit.checked_out_by
        ? hostDisplayName(hostMap.get(visit.checked_out_by) ?? null)
        : "—";
      const purposeLabel = toPurposeLabel(visit.purpose ?? visit.appointment?.purpose ?? null);
      return {
        visitId: visit.id,
        visitorId: visit.visitor_id,
        appointmentId: visit.appointment_id ?? null,
        name: visitor?.full_name ?? "Unknown Visitor",
        nationalId: visitorDetails?.national_id ?? "—",
        phone: visitorDetails?.phone ?? "—",
        organization: buildOrganizationLabel(visitor, student),
        purpose: purposeLabel,
        host: hostDisplayName(host),
        visitDate: formatDate(visit.checked_in_at ?? visit.checked_out_at ?? null),
        checkinTime: formatTime(visit.checked_in_at),
        checkoutTime: visit.checked_out_at ? formatTime(visit.checked_out_at) : undefined,
        checkinAt: visit.checked_in_at ?? null,
        checkoutAt: visit.checked_out_at ?? null,
        checkinBy,
        checkoutBy,
        status: visit.checked_out_at ? "checked-out" : "on-campus",
        notes: visit.notes ?? undefined
      };
    });
  }, [visits, visitorMap, studentMap, hostMap]);

  const scheduledRows = useMemo<AppointmentRow[]>(() => {
    return appointments
      .filter((appointment) =>
        appointment.status !== "cancelled" && appointment.status !== "completed"
      )
      .map((appointment) => {
        const visitor = visitorMap.get(appointment.visitor_id) ?? appointment.visitor ?? null;
        const student = appointment.student ?? (appointment.student_id ? studentMap.get(appointment.student_id) ?? null : null);
        const host = appointment.host
          ? { id: appointment.host.id, name: appointment.host.name ?? null, role: null }
          : appointment.host_id
            ? hostMap.get(appointment.host_id) ?? null
            : null;
        const appointmentAt = appointment.appointment_at ?? null;
        const appointmentDate = formatDate(appointmentAt);
        const appointmentTime = formatTime(appointmentAt);
        return {
          appointmentId: appointment.id,
          visitorId: appointment.visitor_id,
          studentId: appointment.student_id ?? null,
          hostId: appointment.host_id ?? appointment.host?.id ?? null,
          name: visitor?.full_name ?? "Unknown Visitor",
          organization: buildOrganizationLabel(visitor, student),
          host: hostDisplayName(host),
          purpose: toPurposeLabel(appointment.purpose ?? null),
          purposeValue: appointment.purpose ?? null,
          expectedDurationMin: appointment.expected_duration_min ?? null,
          appointmentDate,
          appointmentTime,
          status: appointment.status ?? "pending"
        };
      });
  }, [appointments, visitorMap, studentMap, hostMap]);

  const activeVisits = visitRows.filter((row) => row.status === "on-campus");
  const historyVisits = visitRows.filter((row) => row.status === "checked-out");

  const today = new Date();
  const todaysCount = visits.filter((visit) => {
    if (!visit.checked_in_at) return false;
    const date = new Date(visit.checked_in_at);
    return !Number.isNaN(date.getTime()) && isSameDay(date, today);
  }).length;
  const onCampus = activeVisits.length;
  const pendingCheckout = onCampus;
  const weekTotal = visits.filter((visit) => {
    if (!visit.checked_in_at) return false;
    const date = new Date(visit.checked_in_at);
    return !Number.isNaN(date.getTime()) && isWithinDays(date, 7);
  }).length;

  const handleRegister = async (payload: RegisterPayload) => {
    const appointmentAt = new Date(payload.appointmentAt);
    if (Number.isNaN(appointmentAt.getTime())) {
      toast.error("Invalid appointment date/time");
      return;
    }

    const visitor = await apiRequest<ApiVisitor>("/visitors", {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        full_name: payload.fullName,
        phone: payload.phone || undefined,
        national_id: payload.nationalId || undefined,
        organization: payload.organization || undefined,
        visitor_type: payload.visitorType
      })
    });

    const visitorId = visitor?.id;
    if (!visitorId) {
      toast.error("Visitor registration failed");
      return;
    }

    const now = new Date();
    const scheduleOnly = appointmentAt.getTime() > now.getTime();

    if (scheduleOnly) {
      const appointment = await apiRequest<ApiAppointment>("/visitor-appointments", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          visitor_id: visitorId,
          student_id: payload.studentId || undefined,
          host_id: payload.hostId || undefined,
          purpose: payload.purpose,
          appointment_at: appointmentAt.toISOString(),
          expected_duration_min: payload.expectedDurationMin,
          notes: payload.notes || undefined
        })
      });

      if (appointment?.id) {
        await apiRequest(`/visitor-appointments/${appointment.id}/confirm`, {
          method: "PATCH",
          auth: "school"
        });
      }

      toast.success("Visitor scheduled successfully");
    } else {
      const expectedOutAt = new Date(now.getTime() + payload.expectedDurationMin * 60_000);
      await apiRequest("/visitor-visits", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          visitor_id: visitorId,
          student_id: payload.studentId || undefined,
          host_id: payload.hostId || undefined,
          purpose: payload.purpose,
          checked_in_at: now.toISOString(),
          expected_out_at: expectedOutAt.toISOString(),
          notes: payload.notes || undefined,
          badge_printed: true,
          sms_sent_host: true
        })
      });
      toast.success("Visitor checked in successfully");
    }

    await loadVisitorData();
  };

  const handleCheckInAppointment = async (row: AppointmentRow) => {
    if (row.status === "pending") {
      await apiRequest(`/visitor-appointments/${row.appointmentId}/confirm`, {
        method: "PATCH",
        auth: "school"
      });
    }

    const now = new Date();
    const expectedOutAt = row.expectedDurationMin
      ? new Date(now.getTime() + row.expectedDurationMin * 60_000)
      : null;

    await apiRequest("/visitor-visits", {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        visitor_id: row.visitorId,
        appointment_id: row.appointmentId,
        student_id: row.studentId || undefined,
        host_id: row.hostId || undefined,
        purpose: row.purposeValue || undefined,
        checked_in_at: now.toISOString(),
        expected_out_at: expectedOutAt ? expectedOutAt.toISOString() : undefined
      })
    });

    toast.success("Visitor checked in");
    await loadVisitorData();
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    await apiRequest(`/visitor-appointments/${appointmentId}/cancel`, {
      method: "PATCH",
      auth: "school"
    });
    toast.success("Appointment cancelled");
    await loadVisitorData();
  };

  const handleCheckout = async (row: VisitRow, notes: string) => {
    await apiRequest(`/visitor-visits/${row.visitId}/check-out`, {
      method: "PATCH",
      auth: "school",
      body: JSON.stringify({ notes: notes || undefined })
    });

    if (row.appointmentId) {
      try {
        await apiRequest(`/visitor-appointments/${row.appointmentId}/complete`, {
          method: "PATCH",
          auth: "school"
        });
      } catch {
        // Ignore appointment completion errors on checkout
      }
    }

    toast.success("Visitor checked out");
    await loadVisitorData();
  };

  return (
    <AppLayout title="Visitor Management" subtitle="Campus visitor check-in & check-out">
      <div className="flex justify-end mb-4">
        <button onClick={() => setRegisterOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
          <Plus className="h-4 w-4" /> Register Visitor
        </button>
      </div>

      {loading ? (
        <VisitorsSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => void loadVisitorData()}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label="Today's Visitors" value={todaysCount} icon={<UserCheck className="h-5 w-5" />} />
            <StatCard label="Currently On Campus" value={onCampus} tone="success" icon={<Users className="h-5 w-5" />} />
            <StatCard label="Pending Check-out" value={pendingCheckout} tone="warning" icon={<Clock className="h-5 w-5" />} />
            <StatCard label="This Week Total" value={weekTotal} icon={<Calendar className="h-5 w-5" />} />
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Active Visitors" && (
            <ActiveTab list={activeVisits} onCheckout={setCheckoutTarget} onView={setViewing} />
          )}
          {tab === "Scheduled" && (
            <ScheduledTab
              list={scheduledRows}
              onConfirm={handleCheckInAppointment}
              onCancel={(id) => void handleCancelAppointment(id)}
            />
          )}
          {tab === "History" && <HistoryTab list={historyVisits} />}
          {tab === "Logs" && <LogsTab list={visitRows} />}
        </>
      )}

      {registerOpen && (
        <RegisterModal
          students={students}
          hosts={hosts}
          defaultCountryName={schoolCountry}
          onClose={() => setRegisterOpen(false)}
          onSubmit={async (payload) => {
            await handleRegister(payload);
            setRegisterOpen(false);
          }}
        />
      )}
      {checkoutTarget && (
        <CheckoutModal
          visitor={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onConfirm={(notes) => void handleCheckout(checkoutTarget, notes)}
        />
      )}
      {viewing && <ViewModal visitor={viewing} onClose={() => setViewing(null)} />}
    </AppLayout>
  );
}

function StatusPill({ status }: { status: VisitRow["status"] }) {
  const map = { "on-campus": "bg-success/15 text-success", "checked-out": "bg-muted text-muted-foreground" };
  const label = { "on-campus": "On Campus", "checked-out": "Checked Out" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>{label[status]}</span>;
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground"><UserCheck className="h-6 w-6" /></div>
      <p className="mt-3 text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

function ActiveTab({
  list,
  onCheckout,
  onView
}: {
  list: VisitRow[];
  onCheckout: (v: VisitRow) => void;
  onView: (v: VisitRow) => void;
}) {
  if (list.length === 0) return <EmptyState msg="No visitors currently on campus." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Check-in</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={v.visitId} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={v.name} />
                  <div>
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.organization}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{v.purpose}</td>
              <td className="px-4 py-3">{v.host}</td>
              <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
              <td className="px-4 py-3"><StatusPill status={v.status} /></td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <button onClick={() => onView(v)} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onCheckout(v)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"><LogOut className="h-3.5 w-3.5" /> Check-out</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledTab({
  list,
  onConfirm,
  onCancel
}: {
  list: AppointmentRow[];
  onConfirm: (row: AppointmentRow) => void;
  onCancel: (id: string) => void;
}) {
  if (list.length === 0) return <EmptyState msg="No upcoming scheduled visits." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Date / Time</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => {
            const statusLabel = v.status === "pending" ? "Pending" : "Confirmed";
            const statusClass = v.status === "pending"
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-100 text-blue-700";
            return (
              <tr key={v.appointmentId} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-3 font-semibold">{v.name}</td>
                <td className="px-4 py-3">{v.host}</td>
                <td className="px-4 py-3">{v.appointmentDate} {v.appointmentTime}</td>
                <td className="px-4 py-3">{v.purpose}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => onConfirm(v)} className="rounded-md bg-success/15 text-success px-3 py-1.5 text-xs font-semibold hover:bg-success/25">Check in</button>
                    <button onClick={() => onCancel(v.appointmentId)} className="rounded-md bg-destructive/15 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/25">Cancel</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ list }: { list: VisitRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => list.filter(v => v.name.toLowerCase().includes(q.toLowerCase()) || v.host.toLowerCase().includes(q.toLowerCase())), [list, q]);
  if (list.length === 0) return <EmptyState msg="No visitor history yet." />;
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor or host…" className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm" />
        </div>
        <input type="date" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Visitor</th>
              <th className="px-4 py-3 text-left">Host</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Check-in</th>
              <th className="px-4 py-3 text-left">Check-out</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.visitId} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-3 font-semibold">{v.name}</td>
                <td className="px-4 py-3">{v.host}</td>
                <td className="px-4 py-3">{v.visitDate}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkoutTime || "—"}</td>
                <td className="px-4 py-3">{computeDuration(v.checkinTime, v.checkoutTime)}</td>
                <td className="px-4 py-3">{v.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogsTab({ list }: { list: VisitRow[] }) {
  const events: { timestamp: string; name: string; action: "Entry" | "Exit"; officer: string }[] = [];
  list.forEach(v => {
    if (v.checkinAt) events.push({ timestamp: v.checkinAt, name: v.name, action: "Entry", officer: v.checkinBy ?? "—" });
    if (v.checkoutAt) events.push({ timestamp: v.checkoutAt, name: v.name, action: "Exit", officer: v.checkoutBy ?? "—" });
  });
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (events.length === 0) return <EmptyState msg="No gate events recorded." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">Timestamp</th><th className="px-4 py-3 text-left">Visitor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Gate Officer</th></tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3 font-mono text-xs">{formatDateTime(e.timestamp)}</td>
              <td className="px-4 py-3 font-semibold">{e.name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.action === "Entry" ? "bg-success/15 text-success" : "bg-blue-100 text-blue-700"}`}>{e.action}</span>
              </td>
              <td className="px-4 py-3">{e.officer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisitorsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`visitor-stat-skeleton-${i}`} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border mb-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`visitor-tab-skeleton-${i}`} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={`visitor-head-skeleton-${i}`} className="px-4 py-3 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={`visitor-row-skeleton-${i}`} className="border-t border-border">
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={`visitor-cell-skeleton-${i}-${j}`} className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function computeDuration(inT?: string, outT?: string) {
  if (!inT || !outT || inT === "—") return "—";
  const [h1, m1] = inT.split(":").map(Number);
  const [h2, m2] = outT.split(":").map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}h ${m}m`;
}

// =================== Modals ===================
function useEsc(onClose: () => void) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
}

function ModalShell({ onClose, children, size = "lg" }: { onClose: () => void; children: React.ReactNode; size?: "md" | "lg" | "xl" }) {
  useEsc(onClose);
  const w = size === "md" ? "max-w-md" : size === "xl" ? "max-w-3xl" : "max-w-xl";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full ${w} rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function RegisterModal({
  students,
  hosts,
  defaultCountryName,
  onClose,
  onSubmit
}: {
  students: ApiStudent[];
  hosts: ApiUser[];
  defaultCountryName?: string | null;
  onClose: () => void;
  onSubmit: (payload: RegisterPayload) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    name: "", nationalId: "", phone: "", organization: "",
    visitorType: "parent_guardian" as ApiVisitorType,
    studentSearch: "",
    purpose: "parent_visit" as ApiVisitorPurpose,
    hostId: hosts[0]?.id ?? "",
    appointmentDate: new Date().toISOString().slice(0, 10), appointmentTime: "09:00",
    duration: "1 hr", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const studentOptions = useMemo(
    () => students.map((s) => ({ id: s.id, label: studentLabel(s) })),
    [students]
  );
  const hostOptions = useMemo(
    () => hosts.map((h) => ({ id: h.id, label: hostDisplayName(h) })),
    [hosts]
  );
  const matchedStudent = useMemo(() => {
    const q = data.studentSearch.trim().toLowerCase();
    if (!q) return null;
    const match = studentOptions.find(o => o.label.toLowerCase() === q);
    return match ? students.find(s => s.id === match.id) ?? null : null;
  }, [data.studentSearch, studentOptions]);
  const relationshipOrg = data.visitorType === "parent_guardian"
    ? (matchedStudent ? `Parent of ${matchedStudent.first_name} ${matchedStudent.last_name}` : "")
    : data.organization;
  const organizationValue = relationshipOrg.trim() || "—";
  const hostLabel = hostOptions.find(h => h.id === data.hostId)?.label ?? "—";

  useEffect(() => {
    if (!data.hostId && hosts.length > 0) {
      setData(prev => ({ ...prev, hostId: hosts[0].id }));
    }
  }, [hosts, data.hostId]);

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!data.name.trim()) e.name = "Required";
      if (!data.nationalId.trim()) e.nationalId = "Required";
      if (!data.phone.trim()) e.phone = "Required";
      if (data.visitorType === "parent_guardian" && !matchedStudent) e.studentSearch = "Select a student";
      if (data.visitorType === "organization" && !data.organization.trim()) e.organization = "Required";
    }
    if (s === 2) {
      if (!data.hostId) e.host = "Required";
    }
    setErrors(e); return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => s + 1); };

  const submit = async () => {
    setSubmitting(true);
    try {
      const appointmentAt = new Date(`${data.appointmentDate}T${data.appointmentTime}`);
      if (Number.isNaN(appointmentAt.getTime())) {
        toast.error("Invalid appointment date/time");
        return;
      }

      await onSubmit({
        fullName: data.name,
        nationalId: data.nationalId,
        phone: data.phone,
        organization: organizationValue,
        visitorType: data.visitorType,
        studentId: matchedStudent?.id ?? null,
        hostId: data.hostId || null,
        purpose: data.purpose,
        appointmentAt: appointmentAt.toISOString(),
        expectedDurationMin: durationToMinutes(data.duration),
        notes: data.notes || undefined
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to register visitor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} size="xl">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold">Register Visitor</h2>
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      <div className="px-6 pt-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1">
              <div className={`h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1.5 text-[10px] uppercase tracking-wide font-semibold ${n <= step ? "text-primary" : "text-muted-foreground"}`}>
                {n === 1 ? "Visitor Info" : n === 2 ? "Visit Details" : "Confirm"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {step === 1 && (
          <>
            <Field label="Full Name" required error={errors.name}>
              <input className={inputCls(!!errors.name)} value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="e.g. Bizimana Jean Pierre" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="National ID / Passport" required error={errors.nationalId}>
                <input className={inputCls(!!errors.nationalId)} value={data.nationalId} onChange={e => setData({ ...data, nationalId: e.target.value })} placeholder="1199…" />
              </Field>
              <SaPhoneInput
                label="Phone"
                value={data.phone}
                onChange={(phone) => setData({ ...data, phone })}
                defaultCountryName={defaultCountryName ?? undefined}
                error={!!errors.phone}
                className="md:col-span-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Visitor Type" required>
                <select
                  className={inputCls(false)}
                  value={data.visitorType}
                  onChange={e => {
                    const visitorType = e.target.value as ApiVisitorType;
                    const nextPurpose = visitorType === "parent_guardian"
                      ? "parent_visit"
                      : data.purpose === "parent_visit" ? "official_business" : data.purpose;
                    setData({ ...data, visitorType, purpose: nextPurpose });
                  }}
                >
                  {VISITOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {data.visitorType === "parent_guardian" ? (
                <Field label="Student (Search)" required error={errors.studentSearch}>
                  <input
                    list="visitor-students"
                    className={inputCls(!!errors.studentSearch)}
                    value={data.studentSearch}
                    onChange={e => setData({ ...data, studentSearch: e.target.value })}
                    placeholder="e.g. Fabrice - S1A"
                  />
                  <datalist id="visitor-students">
                    {studentOptions.map(o => <option key={o.id} value={o.label} />)}
                  </datalist>
                  {matchedStudent && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved as: Parent of {matchedStudent.first_name} {matchedStudent.last_name} ({matchedStudent.current_section?.full_name ?? "—"})
                    </p>
                  )}
                </Field>
              ) : (
                <Field label="Organization / Relationship" required error={errors.organization}>
                  <input
                    className={inputCls(!!errors.organization)}
                    value={data.organization}
                    onChange={e => setData({ ...data, organization: e.target.value })}
                    placeholder="e.g. Ministry of Education"
                  />
                </Field>
              )}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Purpose of Visit" required>
                <select className={inputCls(false)} value={data.purpose} onChange={e => setData({ ...data, purpose: e.target.value as ApiVisitorPurpose })}>
                  {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Host (Staff)" required error={errors.host}>
                <select className={inputCls(!!errors.host)} value={data.hostId} onChange={e => setData({ ...data, hostId: e.target.value })}>
                  {hostOptions.map((h) => (
                    <option key={h.id} value={h.id}>{h.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Date">
                <input type="date" className={inputCls(false)} value={data.appointmentDate} onChange={e => setData({ ...data, appointmentDate: e.target.value })} />
              </Field>
              <Field label="Time">
                <input type="time" className={inputCls(false)} value={data.appointmentTime} onChange={e => setData({ ...data, appointmentTime: e.target.value })} />
              </Field>
              <Field label="Expected Duration">
                <select className={inputCls(false)} value={data.duration} onChange={e => setData({ ...data, duration: e.target.value })}>
                  {["30 min", "1 hr", "2 hrs", "Half day", "Full day"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea rows={3} className={inputCls(false)} value={data.notes} onChange={e => setData({ ...data, notes: e.target.value })} placeholder="Any additional info…" />
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <Row k="Visitor" v={data.name} />
              <Row k="National ID" v={data.nationalId} />
              <Row k="Phone" v={data.phone} />
              {data.visitorType === "parent_guardian" && matchedStudent && (
                <Row k="Student" v={`${matchedStudent.first_name} ${matchedStudent.last_name}`} />
              )}
              <Row k="Organization / Relationship" v={organizationValue} />
              <Row k="Purpose" v={PURPOSE_LABEL[data.purpose]} />
              <Row k="Host" v={hostLabel} />
              <Row k="When" v={`${data.appointmentDate} • ${data.appointmentTime} (${data.duration})`} />
              {data.notes && <Row k="Notes" v={data.notes} />}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
        <button onClick={() => step === 1 ? onClose() : setStep(s => s - 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          <ChevronLeft className="h-4 w-4" /> {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 3 ? (
          <button onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button disabled={submitting} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {submitting && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            Confirm & Check-in
          </button>
        )}
      </div>

      {/* Print badge layout (visible only on print) */}
      <div className="hidden print:block fixed inset-0 bg-white p-12">
        <div className="border-4 border-slate-900 p-8 max-w-md mx-auto text-center">
          <p className="text-4xl font-bold tracking-widest">VISITOR</p>
          <div className="mx-auto my-6 h-32 w-32 bg-muted grid place-items-center text-muted-foreground">PHOTO</div>
          <p className="text-2xl font-bold">{data.name}</p>
          <p className="mt-2 text-sm">Host: {hostLabel}</p>
          <p className="text-sm">Purpose: {PURPOSE_LABEL[data.purpose]}</p>
          <p className="text-sm">Date: {data.appointmentDate}</p>
        </div>
      </div>
    </ModalShell>
  );
}

function CheckoutModal({
  visitor,
  onClose,
  onConfirm
}: {
  visitor: VisitRow;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const now = formatTime(new Date().toISOString());
  return (
    <ModalShell onClose={onClose} size="md">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">Check-out Visitor</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-6 space-y-3 text-sm">
        <Row k="Visitor" v={visitor.name} />
        <Row k="Check-in" v={visitor.checkinTime} />
        <Row k="Check-out" v={now} />
        <Row k="Duration" v={computeDuration(visitor.checkinTime, now)} />
        <Field label="Notes (optional)">
          <textarea rows={2} className={inputCls(false)} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4 bg-muted/20">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
        <button onClick={() => onConfirm(notes)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <CheckCircle2 className="h-4 w-4" /> Complete Check-out
        </button>
      </div>
    </ModalShell>
  );
}

function ViewModal({ visitor, onClose }: { visitor: VisitRow; onClose: () => void }) {
  const statusLabel = visitor.status === "on-campus" ? "On Campus" : "Checked Out";
  return (
    <ModalShell onClose={onClose} size="md">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">Visitor Details</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-6 space-y-2 text-sm">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={visitor.name} />
          <div><p className="font-semibold">{visitor.name}</p><p className="text-xs text-muted-foreground">{visitor.organization}</p></div>
        </div>
        <Row k="National ID" v={visitor.nationalId} />
        <Row k="Phone" v={visitor.phone} />
        <Row k="Purpose" v={visitor.purpose} />
        <Row k="Host" v={visitor.host} />
        <Row k="Check-in" v={visitor.checkinTime} />
        <Row k="Check-out" v={visitor.checkoutTime || "—"} />
        <Row k="Status" v={statusLabel} />
        {visitor.notes && <Row k="Notes" v={visitor.notes} />}
      </div>
    </ModalShell>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
function inputCls(err: boolean) {
  return `w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${err ? "border-destructive" : "border-border"}`;
}
