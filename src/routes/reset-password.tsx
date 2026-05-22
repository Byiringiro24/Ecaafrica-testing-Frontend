import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  })();
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];
  const colors = ["bg-red-500", "bg-red-400", "bg-amber-400", "bg-indigo-500", "bg-indigo-700"];

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground mx-auto">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mt-5">Set new password</h1>
        <p className="text-center text-sm text-muted-foreground mt-1">Choose a strong password you'll remember</p>

        <form className="mt-6 space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (pwd !== confirm) { toast.error("Passwords do not match"); return; }
          if (strength < 2) { toast.error("Choose a stronger password"); return; }
          setLoading(true);
          await new Promise(r => setTimeout(r, 600));
          setLoading(false);
          toast.success("Password updated. Please sign in.");
          navigate({ to: "/login" });
        }}>
          <div>
            <label className="text-sm font-medium">New Password</label>
            <input type="password" required value={pwd} onChange={e => setPwd(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            {pwd && (
              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full transition-all ${colors[strength]}`} style={{ width: `${(strength / 4) * 100}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{labels[strength]}</div>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Confirm Password</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button disabled={loading} className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
          </button>
          <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">← Back to login</Link>
        </form>
      </div>
    </div>
  );
}
