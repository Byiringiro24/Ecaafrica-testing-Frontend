import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import logo from "@/assets/netrack-logo.png";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

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
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0A3D91] mb-2">Reset your password</h1>
            <p className="text-xs text-[#5F6B7A]">Enter your email to receive reset instructions</p>
          </div>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm text-[#1A1A1A]">
              If an account exists for <b>{email}</b>, we've sent a reset link.
            </p>
            <p className="text-xs text-[#5F6B7A] mt-2">Check your inbox and spam folder. The link expires in 1 hour.</p>
            <Link to="/login" className="inline-block mt-5 text-[#42A5F5] font-semibold text-sm hover:underline">Back to login</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await apiRequest("/auth/forgot-password", {
                method: "POST",
                auth: "none",
                body: JSON.stringify({ email })
              });
              setSent(true);
            } catch (error) {
              const message = error && typeof error === "object" && "message" in error
                ? String(error.message)
                : "Failed to request reset link.";
              toast.error(message);
            } finally {
              setLoading(false);
            }
          }}>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#5F6B7A] font-bold">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading}
                className="mt-1 h-11 w-full rounded-xl border border-[#EEF4FF] bg-[#F4F7FC]/50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#0A3D91]/30" />
            </div>
            <button disabled={loading} className="h-11 w-full rounded-xl bg-[#0A3D91] text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#1565C0] disabled:opacity-70">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </button>
            <Link to="/login" className="block text-center text-xs text-[#5F6B7A] hover:text-[#0A3D91]">← Back to login</Link>
          </form>
        )}
        </div>
      </div>

      <div className="text-center text-xs text-[#8A94A6] z-10 mt-auto">
        © 2026 ECA – Education Care Africa. Powered by Netrack.
      </div>
    </div>
  );
}
