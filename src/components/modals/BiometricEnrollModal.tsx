import { useState } from "react";
import { X, Camera, Fingerprint, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  mode: "face" | "fingerprint";
  studentName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BiometricEnrollModal({ open, mode, studentName, onClose, onSuccess }: Props) {
  const [state, setState] = useState<"idle" | "scanning" | "success" | "error">("idle");

  if (!open) return null;
  const isFace = mode === "face";
  const Icon = isFace ? Camera : Fingerprint;
  const title = isFace ? "Face Enrollment" : "Fingerprint Enrollment";

  const start = () => {
    setState("scanning");
    setTimeout(() => {
      const ok = Math.random() > 0.15;
      setState(ok ? "success" : "error");
      if (ok) {
        toast.success(`${isFace ? "Face" : "Fingerprint"} enrolled${studentName ? ` for ${studentName}` : ""}`);
        onSuccess?.();
      }
    }, 2000);
  };

  const close = () => { setState("idle"); onClose(); };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">{title}</h3>
          <button onClick={close} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-8 grid place-items-center text-center">
          {isFace ? (
            <div className="relative h-52 w-52 rounded-xl border-2 border-dashed border-border bg-slate-900 overflow-hidden">
              {/* corner brackets */}
              <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-indigo-400" />
              <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-indigo-400" />
              <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-indigo-400" />
              <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-indigo-400" />
              {state === "scanning" && (
                <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_12px_2px] shadow-indigo-400 scan-line" />
              )}
              <Camera className="absolute inset-0 m-auto h-10 w-10 text-slate-500" />
            </div>
          ) : (
            <div className="relative h-52 w-52 grid place-items-center">
              {state === "scanning" && (
                <>
                  <span className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
                  <span className="absolute inset-4 rounded-full border-4 border-primary/30 animate-pulse" />
                </>
              )}
              <Icon className={`h-28 w-28 ${
                state === "success" ? "text-success" :
                state === "error" ? "text-destructive" :
                state === "scanning" ? "text-primary" : "text-muted-foreground"
              }`} />
              {state === "success" && <CheckCircle2 className="absolute bottom-4 right-6 h-10 w-10 text-success bg-card rounded-full" />}
            </div>
          )}

          <p className="mt-5 text-sm font-semibold">
            {state === "idle" && (isFace ? "Position face in frame" : "Place finger on the scanner")}
            {state === "scanning" && (isFace ? "Analyzing facial features…" : "Scanning fingerprint…")}
            {state === "success" && `✅ ${isFace ? "Face" : "Fingerprint"} enrolled successfully`}
            {state === "error" && (isFace ? "Could not detect face clearly — try again" : "Scan failed — try again")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{isFace ? "Ensure good lighting for accurate recognition" : "Hold still for 2 seconds"}</p>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={close} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            {state === "success" ? "Done" : "Close"}
          </button>
          {state !== "success" && (
            <button onClick={start} disabled={state === "scanning"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {state === "scanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {isFace ? "Capture Photo" : "Scan Finger"}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
        .scan-line { animation: scanLine 1.6s linear infinite; }
      `}</style>
    </div>
  );
}
