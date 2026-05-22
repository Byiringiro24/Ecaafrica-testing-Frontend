import { ReactNode, useEffect } from "react";
import { Inbox, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function StaffModal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`bg-card rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col border border-border ${wide ? "max-w-2xl" : "max-w-lg"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border">{footer}</div>}
      </div>
    </div>
  );
}

export function LockdownDialog({
  open,
  onClose,
  onConfirm,
  step,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  step: 1 | 2;
}) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            {step === 1 ? "Emergency Lockdown?" : "Confirm lockdown"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1
              ? "This will restrict campus access and notify all staff immediately."
              : "Are you sure? This will notify all staff and lock all gates."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            {step === 1 ? "Continue" : "Activate Lockdown"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmptyState({ icon: Icon, message }: { icon: typeof Inbox; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export type CampusStatus = "OPEN" | "LOCKED DOWN" | "RESTRICTED";

export function campusStatusStyle(status: CampusStatus) {
  if (status === "OPEN") return { badge: "bg-primary/10 text-primary", dot: "bg-primary" };
  if (status === "RESTRICTED") return { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };
  return { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" };
}
