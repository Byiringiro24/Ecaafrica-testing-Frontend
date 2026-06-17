import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { Mail, Phone, Building2, Calendar, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_ME } from "@/lib/teacherStaffData";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/profile")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherProfile
});

type TeacherProfileRecord = {
  id: string;
  user_id?: string | null;
  staff_id_number?: string | null;
  gender?: "male" | "female" | "other" | null;
  department?: string | null;
  contract_type?: "permanent" | "contract" | "part_time" | null;
  join_date?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  qualifications?: string | null;
  experience?: string | null;
  timetable_access?: string | null;
  basic_salary?: string | null;
  employment_status?: "active" | "on_leave" | "inactive" | null;
  subjects?: string[] | null;
  user?: { id: string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null } | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-CA");
};

const joinList = (values?: string[] | null) =>
  values && values.length > 0 ? values.filter(Boolean).join(", ") : "--";

function TeacherProfile() {
  const [tab, setTab] = useState<"personal" | "work" | "security">("personal");
  const [profile, setProfile] = useState<TeacherProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useCurrentUser();

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<TeacherProfileRecord>("/staff/profiles/me", {
          auth: "school"
        });
        setProfile(data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const initials = currentUser?.name ? getInitials(currentUser.name) : TEACHER_ME.initials;
  const name = currentUser?.name ?? profile?.user?.name ?? TEACHER_ME.name;
  const email = currentUser?.email ?? profile?.user?.email ?? TEACHER_ME.email;
  const phone = currentUser?.phone ?? profile?.user?.phone ?? TEACHER_ME.phone;
  const role = currentUser?.role ? formatRole(currentUser.role) : "Teacher";
  const employeeId = profile?.staff_id_number ?? TEACHER_ME.employeeId;
  const department = profile?.department ?? TEACHER_ME.department;
  const contractType = profile?.contract_type ? formatRole(profile.contract_type) : "--";
  const dateJoined = profile?.join_date ? formatDate(profile.join_date) : TEACHER_ME.dateJoined;
  const gender = profile?.gender ? formatRole(profile.gender) : "--";
  const dateOfBirth = profile?.date_of_birth ? formatDate(profile.date_of_birth) : "--";
  const address = profile?.address ?? "--";
  const timetableAccess = profile?.timetable_access ?? "--";
  const subjects = joinList(profile?.subjects);
  const employmentStatus = profile?.employment_status ? formatRole(profile.employment_status) : "--";
  const profileRole = profile?.user?.role ? formatRole(profile.user.role) : role;

  return (
    <TeacherLayout title="My Profile">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground font-bold text-3xl mb-3">{initials}</div>
          <h2 className="font-display font-bold text-lg">{name}</h2>
          <div className="text-xs text-muted-foreground">{employeeId}</div>
          <div className="flex justify-center gap-2 mt-3">
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-indigo-100 text-indigo-800">{department}</span>
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700">{profile?.user ? profileRole : "Teacher"}</span>
          </div>
          <div className="mt-5 space-y-2 text-sm text-left">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {email}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {phone}</div>
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {profileRole}</div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Joined {dateJoined}</div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex border-b border-border">
            {(["personal", "work", "security"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                {t === "personal" ? "Personal Info" : t === "work" ? "Work Info" : "Security"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-10 rounded-lg bg-muted" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
            ) : (
              <>
                {tab === "personal" && (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[
                      ["Full Name", name],
                      ["Date of Birth", dateOfBirth],
                      ["Gender", gender],
                      ["Address", address],
                      ["Email", email],
                      ["Phone", phone]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                        <div className="mt-1 h-10 px-3 grid items-center rounded-md bg-muted text-sm">{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "work" && (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[
                      ["Employee ID", employeeId],
                      ["Department", department],
                      ["Contract Type", contractType],
                      ["Date Joined", dateJoined],
                      ["Timetable Access", timetableAccess],
                      ["Employment Status", employmentStatus],
                      ["Subjects", subjects]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                        <div className="mt-1 h-10 px-3 grid items-center rounded-md bg-muted text-sm break-words">{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "security" && (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[
                      ["Account Role", profileRole],
                      ["Status", employmentStatus],
                      ["Email", email],
                      ["Phone", phone],
                      ["Subjects", subjects],
                      ["Timetable Access", timetableAccess]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                        <div className="mt-1 h-10 px-3 grid items-center rounded-md bg-muted text-sm">{value}</div>
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Security</div>
                      <Link to="/forgot-password" className="h-10 inline-flex w-full items-center justify-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
                        Change Password
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

function PwdForm() {
  const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-4 max-w-md" onSubmit={async e => { e.preventDefault(); setLoading(true); await new Promise(r => setTimeout(r, 600)); setLoading(false); toast.success("Password updated"); }}>
      <div><label className="text-sm font-medium">Current Password</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-sm font-medium">New Password</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-sm font-medium">Confirm New Password</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <button disabled={loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Update Password</button>
      <div className="pt-4 border-t border-border text-xs text-muted-foreground"><div className="font-semibold mb-1 text-foreground">Last login</div><div>Today at 06:55 from Kigali · Chrome on Windows</div></div>
    </form>
  );
}
