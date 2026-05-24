import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap, Loader2, ShieldCheck, Building2, Users, ArrowLeft,
} from "lucide-react";
import logo from "@/assets/netrack-logo.png";
import { MOCK_USERS } from "@/lib/teacherStaffData";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const DEMO_ROLES = [
  { label: "School Admin", sub: "View Demo", to: "/dashboard", icon: Building2 },
  { label: "Teacher Panel", sub: "View Demo", to: "/teacher/dashboard", icon: GraduationCap },
  { label: "Staff Panel", sub: "View Demo", to: "/staff/dashboard", icon: ShieldCheck },
  { label: "Super Admin", sub: "View Demo", to: "/super-admin", icon: Users },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter both email and password."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const user = MOCK_USERS.find(u => u.email === email && u.password === password);
    if (!user) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }
    try { localStorage.setItem("ecareafrica_user", JSON.stringify(user)); } catch {}
    toast.success(`Welcome back, ${user.name}!`);
    setTimeout(() => navigate({ to: user.redirectTo }), 400);
  };

  const goDemo = (to: string, label: string) => {
    if (to === "#") return;
    toast.success(`Loading ${label} demo…`);
    setTimeout(() => navigate({ to }), 300);
  };

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans antialiased flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">

      <div className="absolute top-0 right-0 w-75 h-75 bg-linear-to-br from-[#42A5F5]/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-75 h-75 bg-linear-to-tr from-[#0A3D91]/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5F6B7A] hover:text-[#0A3D91] transition-all group">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Return Home
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="ECA System" className="h-8 w-8 object-contain" />
          <span className="font-display font-bold text-sm text-[#0A3D91] tracking-tight">ECA System</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 my-auto">
        <div className="bg-white border border-[#EEF4FF] p-8 sm:p-10 rounded-2xl shadow-[0_10px_30px_-5px_rgba(10,61,145,0.05)]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#0A3D91]/5 rounded-2xl mx-auto flex items-center justify-center mb-4 text-[#0A3D91]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0A3D91] mb-2">Welcome back</h1>
            <p className="text-xs text-[#5F6B7A]">Enter your credentials to access your academic dashboard</p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Email address</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder="admin@gspk.rw" required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Password</Label>
                <span className="text-xs text-[#42A5F5] font-semibold cursor-pointer hover:underline">Forgot password?</span>
              </div>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#0A3D91] hover:bg-[#1565C0] text-white rounded-xl h-11 shadow-md font-semibold transition-all hover:scale-[1.01] mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-[#EEF4FF]">
            <div className="flex-1 h-px bg-[#EEF4FF]" /> <span className="text-[#5F6B7A]">OR</span> <div className="flex-1 h-px bg-[#EEF4FF]" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.label} type="button"
                  onClick={() => goDemo(r.to, r.label)}
                  className="group rounded-lg border border-[#EEF4FF] bg-white px-3 py-2.5 text-left transition-all hover:border-[#0A3D91] hover:text-[#0A3D91] flex items-center gap-2.5 shadow-sm hover:shadow-md">
                  <Icon className="h-4 w-4 shrink-0 text-[#5F6B7A] group-hover:text-[#0A3D91]" />
                  <div>
                    <div className="text-xs font-semibold leading-tight text-[#1A1A1A] group-hover:text-[#0A3D91]">{r.label}</div>
                    <div className="text-[10px] text-[#8A94A6]">{r.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 text-center text-xs text-[#5F6B7A] pt-6 border-t border-[#EEF4FF]">
            Need a school account?{" "}
            <Link to="/contact" className="text-[#42A5F5] font-bold hover:underline">Contact sales</Link>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-[#8A94A6] z-10 mt-auto">
        © 2026 ECA – Education Care Africa. Powered by Netrack.
      </div>
    </div>
  );
}
 