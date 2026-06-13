import { ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildPhoneValue,
  countryFlagSrc,
  findCountryByName,
  parsePhoneValue,
  searchCountries,
  type Country,
} from "@/lib/countries";
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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

export function SaCountrySelect({ label, value, onChange, onTimezoneChange, onCurrencyChange, className }: { label: string; value?: string; onChange: (v: string) => void; onTimezoneChange?: (timezone: string) => void; onCurrencyChange?: (currency: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedCountry = useMemo(() => (value ? findCountryByName(value) : undefined), [value]);
  const filtered = useMemo(() => searchCountries(query), [query]);

  const handleSelect = (country: Country) => {
    onChange(country.name);
    onTimezoneChange?.(country.timezone);
    onCurrencyChange?.(country.currency.code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1.5 text-foreground">{label}</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen((s) => !s)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-left flex items-center gap-2">
          {selectedCountry || value ? (
            <>
              {selectedCountry ? (
                <img src={countryFlagSrc(selectedCountry.flag)} alt="" className="w-5 h-3 object-cover rounded-sm" />
              ) : null}
              <span className="truncate">{selectedCountry?.name ?? value}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select country</span>
          )}
          <span className="ml-auto text-muted-foreground">▾</span>
        </button>

        {open && (
          <div className="absolute z-20 right-0 mt-2 p-2 min-w-[280px] w-full bg-card border border-border rounded-md shadow-lg max-h-64 overflow-auto">
            <div className="mb-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country..."
                autoFocus
                className="w-full text-sm px-2 py-2 rounded-md border border-border bg-background"
              />
            </div>
            <ul className="text-sm">
              {filtered.map((country) => (
                <li key={country.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(country)}
                    className="w-full text-left p-2 flex items-center gap-2 hover:bg-muted rounded"
                  >
                    <img src={countryFlagSrc(country.flag)} alt="" className="w-5 h-3 object-cover rounded-sm shrink-0" />
                    <span className="truncate flex-1">{country.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{country.timezone}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="p-2 text-xs text-muted-foreground">No results</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function SaPhoneInput({
  label,
  value,
  onChange,
  defaultCountryName,
  className,
  placeholder = "Phone number",
  error = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultCountryName?: string;
  className?: string;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const parsed = useMemo(() => parsePhoneValue(value), [value]);
  const defaultCountry = useMemo(
    () => (defaultCountryName ? findCountryByName(defaultCountryName) : undefined),
    [defaultCountryName],
  );
  const selectedCountry = parsed.country ?? defaultCountry;
  const filtered = useMemo(() => searchCountries(query), [query]);

  const handleCountrySelect = (country: Country) => {
    onChange(buildPhoneValue(country, parsed.nationalNumber));
    setOpen(false);
    setQuery("");
  };

  const handleNumberChange = (nationalNumber: string) => {
    onChange(buildPhoneValue(selectedCountry, nationalNumber));
  };

  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1.5 text-foreground">{label}</label>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            className={cn(
              "h-10 min-w-[7.5rem] rounded-lg border bg-background px-2 text-sm flex items-center gap-1.5",
              error ? "border-destructive" : "border-border",
            )}
          >
            {selectedCountry ? (
              <>
                <img src={countryFlagSrc(selectedCountry.flag)} alt="" className="w-5 h-3 object-cover rounded-sm shrink-0" />
                <span className="font-medium tabular-nums">{selectedCountry.phoneCode}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Code</span>
            )}
            <span className="ml-auto text-muted-foreground text-xs">▾</span>
          </button>

          {open && (
            <div className="absolute z-20 left-0 mt-2 p-2 min-w-[280px] bg-card border border-border rounded-md shadow-lg max-h-64 overflow-auto">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code..."
                autoFocus
                className="w-full text-sm px-2 py-2 mb-2 rounded-md border border-border bg-background"
              />
              <ul className="text-sm">
                {filtered.map((country) => (
                  <li key={country.id}>
                    <button
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className="w-full text-left p-2 flex items-center gap-2 hover:bg-muted rounded"
                    >
                      <img src={countryFlagSrc(country.flag)} alt="" className="w-5 h-3 object-cover rounded-sm shrink-0" />
                      <span className="truncate flex-1">{country.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{country.phoneCode}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="p-2 text-xs text-muted-foreground">No results</li>}
              </ul>
            </div>
          )}
        </div>
        <input
          type="tel"
          value={parsed.nationalNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-10 flex-1 min-w-0 rounded-lg border bg-background px-3 text-sm",
            error ? "border-destructive" : "border-border",
          )}
        />
      </div>
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
