import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, ArrowLeft,
} from "lucide-react";
import logo from "@/assets/netrack-logo.png";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { setPlatformAuth } from "@/lib/platformAuth";

type LoginResponse = {
  user: { id: string; name?: string | null; email?: string | null; role?: string | null };
  accessToken: string;
  refreshToken?: string | null;
};

type LoginMode = "school" | "platform";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    mode: search.mode === "platform" ? "platform" : "school"
  })
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, mode } = Route.useSearch();
  const loginMode: LoginMode = mode ?? "school";
  const isPlatform = loginMode === "platform";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter both email and password."); return; }
    setLoading(true);
    try {
      const result = await apiRequest<LoginResponse>(
        isPlatform ? "/auth/platform/login" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          auth: "none"
        }
      );

      if (isPlatform) {
        setPlatformAuth({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? null,
          user: result.user
        });
      } else {
        window.localStorage.setItem(
          "eca_school_auth",
          JSON.stringify({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken ?? null,
            user: result.user
          })
        );
      }

      toast.success(
        `Welcome back, ${result.user?.name ?? (isPlatform ? "Platform Admin" : "School Admin")}!`
      );
      const fallbackRoute = isPlatform ? "/super-admin" : "/dashboard";
      navigate({ to: isPlatform ? (redirect || fallbackRoute) : fallbackRoute });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
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
            <h1 className="font-display text-2xl font-bold text-[#0A3D91] mb-2">
              {isPlatform ? "Platform Login" : "School Login"}
            </h1>
            <p className="text-xs text-[#5F6B7A]">
              {isPlatform
                ? "Sign in with your platform admin credentials"
                : "Sign in with your school admin credentials"}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Email address</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder={isPlatform ? "admin@platform.test" : "admin@school.rw"} required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Password</Label>
                <Link to="/forgot-password" className="text-xs text-[#42A5F5] font-semibold hover:underline">Forgot password?</Link>
              </div>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required className="bg-[#F4F7FC]/50 h-11 border-[#EEF4FF] focus-visible:ring-[#0A3D91] rounded-xl" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#0A3D91] hover:bg-[#1565C0] text-white rounded-xl h-11 shadow-md font-semibold transition-all hover:scale-[1.01] mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 text-center text-xs text-[#5F6B7A] pt-6 border-t border-[#EEF4FF] space-y-2">
            <div>
              Need a school account?{" "}
              <Link to="/contact" className="text-[#42A5F5] font-bold hover:underline">Contact sales</Link>
            </div>
            <div>
              {isPlatform ? "School login?" : "Platform admin?"}{" "}
              <Link
                to="/login"
                search={{ redirect, mode: isPlatform ? "school" : "platform" }}
                className="text-[#42A5F5] font-bold hover:underline"
              >
                {isPlatform ? "School Login" : "Platform Login"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-[#8A94A6] z-10 mt-auto">
        © 2026 ECA – Education Care Africa. Powered by Netrack.
      </div>
    </div>
  );
}
 