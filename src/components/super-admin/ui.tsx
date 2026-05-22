import { ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-xs text-muted-foreground font-mono tabular-nums">
      {now.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}
    </span>
  );
}

export function ChartCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="font-display font-semibold text-sm mb-3">{title}</div>
      {children}
    </div>
  );
}

export function SaModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
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
        className={cn(
          "bg-card rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col border border-border",
          wide ? "max-w-4xl" : "max-w-2xl",
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex justify-between items-start gap-4">
          <div>
            <h3 className="font-display font-semibold text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
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

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { onConfirm(); onClose(); }}
            className={destructive ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-sm">
      <div className="text-muted-foreground text-xs">
        Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 rounded border border-border disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium tabular-nums">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1.5 rounded border border-border disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 items-center mb-4">{children}</div>;
}

export function SaInput({ label, className, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1.5 text-foreground">{label}</label>
      <input className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" {...props} />
    </div>
  );
}

export function SaSelect({ label, children, className, ...props }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1.5">{label}</label>
      <select className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" {...props}>{children}</select>
    </div>
  );
}

export function JsonDiff({ before, after }: { before?: Record<string, unknown>; after?: Record<string, unknown> }) {
  if (!before && !after) return null;
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Before</div>
        <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">{JSON.stringify(before ?? {}, null, 2)}</pre>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">After</div>
        <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">{JSON.stringify(after ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}

export function PageTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border mb-5 overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors",
            active === t ? "border-amber-500 text-amber-700" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
