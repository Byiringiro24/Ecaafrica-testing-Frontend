import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import {
  GraduationCap, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck,
  Building2, Users, BellRing, Home, Languages, ArrowRight,
} from "lucide-react";
import { MOCK_USERS } from "@/lib/teacherStaffData";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FEATURES = [
  { icon: ShieldCheck, text: "Biometric Attendance" },
  { icon: BellRing, text: "Real-time Parent Notifications" },
  { icon: Building2, text: "Multi-school SaaS Platform" },
  { icon: Home, text: "Boarding & Gate Management" },
  { icon: Languages, text: "Bilingual (EN/KIN) Support" },
];

const DEMO_ROLES: Array<{ label: string; sub: string; to: string; icon: any; disabled?: boolean }> = [
  { label: "School Admin", sub: "View Demo", to: "/dashboard", icon: Building2 },
  { label: "Teacher Panel", sub: "View Demo", to: "/teacher/dashboard", icon: GraduationCap },
  { label: "Staff Panel", sub: "View Demo", to: "/staff/dashboard", icon: ShieldCheck },
  { label: "Super Admin", sub: "View Demo", to: "/super-admin", icon: Users },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
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
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left navy panel */}
    
      {/* Right form panel */}
      <div className="flex-1 p-6 md:p-12 flex flex-col">
       
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
           
            {!forgot ? (
              <>
                

                {error && (
                  <div className="mt-5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 animate-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4 hidden">
                  <div>
                    <label className="text-sm font-medium" htmlFor="email">Email Address</label>
                    <input id="email" type="text" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                      className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="admin@gspk.rw" autoComplete="email" />
                  </div>
                  <div>
                    <label className="text-sm font-medium" htmlFor="pwd">Password</label>
                    <div className="relative mt-1">
                      <input id="pwd" type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="••••••••" autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground" aria-label="Toggle password visibility">
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input" /> Remember me
                    </label>
                    <button type="button" onClick={() => setForgot(true)} className="text-primary font-semibold hover:underline">Forgot password?</button>
                  </div>
                  <button type="submit" disabled={loading}
                    className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-70 transition-colors">
                    {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>) : "Sign In"}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex-1 h-px bg-border" /> OR <div className="flex-1 h-px bg-border" />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Quick Demo Access</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {DEMO_ROLES.map((r) => {
                      const Icon = r.icon;
                      const isCenter = r.label === "Parent Portal";
                      return (
                        <button key={r.label} type="button" disabled={r.disabled}
                          onClick={() => goDemo(r.to, r.label)}
                          className={`group rounded-lg border px-3 py-2.5 text-left transition-all flex items-center gap-2.5 ${
                            r.disabled ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                       : "border-gray-200 bg-white hover:border-primary hover:text-primary hover:shadow-sm"
                          } ${isCenter ? "col-span-2 justify-center" : ""}`}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold leading-tight">{r.label}</div>
                            <div className="text-[10px] text-muted-foreground">{r.sub}</div>
                          </div>
                          {!r.disabled && <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      );
                    })}
                  </div>
                  
                </div>
              </>
            ) : (
              <ForgotInline onBack={() => setForgot(false)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ForgotInline({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <h2 className="font-display text-2xl font-bold text-center">Reset your password</h2>
      <p className="text-center text-sm text-muted-foreground mt-1">Enter your email to receive a reset link</p>
      {sent ? (
        <div className="mt-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm">Check your email for reset instructions.</p>
          <button onClick={onBack} className="mt-4 text-primary font-semibold text-sm hover:underline">Back to login</button>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          await new Promise(r => setTimeout(r, 600));
          setLoading(false);
          setSent(true);
        }}>
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button type="submit" disabled={loading}
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
          </button>
          <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">← Back to login</button>
        </form>
      )}
    </>
  );
}
