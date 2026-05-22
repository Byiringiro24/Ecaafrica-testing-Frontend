import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground mx-auto">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mt-5">Reset your password</h1>
        <p className="text-center text-sm text-muted-foreground mt-1">Enter your email to receive reset instructions</p>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm">If an account exists for <b>{email}</b>, we've sent a reset link.</p>
            <Link to="/login" className="inline-block mt-5 text-primary font-semibold text-sm hover:underline">Back to login</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={async (e) => {
            e.preventDefault(); setLoading(true);
            await new Promise(r => setTimeout(r, 600));
            setLoading(false); setSent(true);
          }}>
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <button disabled={loading} className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-70">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </button>
            <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">← Back to login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
