import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {danger && <div className="grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-destructive"><AlertTriangle className="h-5 w-5" /></div>}
            <h3 className="font-display font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="px-6 py-5 text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${danger ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
