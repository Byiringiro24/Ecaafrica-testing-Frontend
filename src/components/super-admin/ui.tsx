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

// Call backend proxy to avoid CORS and keep API key secret
const REST_COUNTRIES_API_URL = "/api/v1/external/restcountries";
const SEARCH_DEBOUNCE_MS = 300;

export function SaCountrySelect({ label, value, onChange, onTimezoneChange, className }: { label: string; value?: string; onChange: (v: string) => void; onTimezoneChange?: (timezone: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelectedCountry(null);
      return;
    }
    const found = countries.find((c) => c.name === value);
    if (found) setSelectedCountry(found);
  }, [value, countries]);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!query.trim()) {
      setCountries([]);
      setLoading(false);
      return;
    }

    timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${REST_COUNTRIES_API_URL}?q=${encodeURIComponent(query)}&pretty=true`);
        const json = await res.json();
        if (!mounted) return;

        // Support multiple possible response shapes from the proxy / API
        let objects: any[] = [];
        if (Array.isArray(json)) {
          objects = json;
        } else if (Array.isArray(json?.data?.objects)) {
          objects = json.data.objects;
        } else if (Array.isArray(json?.objects)) {
          objects = json.objects;
        } else if (Array.isArray(json?.items)) {
          objects = json.items;
        } else if (json?.data) {
          // pick first array inside data
          for (const k of Object.keys(json.data)) {
            if (Array.isArray((json.data as any)[k])) {
              objects = (json.data as any)[k];
              break;
            }
          }
        }

        const items = objects
          .map((country: any) => {
            const name = country.names?.common || country.name?.common || country.name || country.common || country.names?.official || (typeof country === "string" ? country : null);
            const flag = country.flag?.url_svg || country.flag?.svg || country.flag || country.flag_url || country.flags?.svg || country.flags?.png || "";
            const timezones = Array.isArray(country.timezones) ? country.timezones : country.timezone ? [country.timezone] : [];
            const id = country.codes?.alpha_2 || country.cca2 || country.alpha2Code || country.codes?.alpha_3 || name;
            return {
              id,
              name,
              flag,
              timezones,
            };
          })
          .filter((item: any) => item.name)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        setCountries(items);
      } catch (e) {
        console.error("failed to load countries", e);
        setCountries([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [query]);

  const selected = selectedCountry;
  const selectedName = selected?.name || value;
  const selectedFlag = selected?.flag;
  const filtered = countries;

  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1.5 text-foreground">{label}</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen((s) => !s)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-left flex items-center gap-2">
          {selectedName ? (
            <>
              {selectedFlag ? <img src={selectedFlag} alt="flag" className="w-5 h-3 object-cover rounded-sm" /> : null}
              <span className="truncate">{selectedName}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select country</span>
          )}
          <span className="ml-auto text-muted-foreground">▾</span>
        </button>

        {open && (
          <div className="absolute z-20 right-0 mt-2 p-2 min-w-[220px] w-full bg-card border border-border rounded-md shadow-lg max-h-64 overflow-auto">
            <div className="mb-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full text-sm px-2 py-2 rounded-md border border-border bg-background"
              />
            </div>
            {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
            <ul className="text-sm">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.name);
                      if (onTimezoneChange && c.timezones.length) onTimezoneChange(c.timezones[0]);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full text-left p-2 flex items-center gap-2 hover:bg-muted rounded"
                  >
                    {c.flag ? <img src={c.flag} alt="flag" className="w-5 h-3 object-cover rounded-sm" /> : null}
                    <span className="truncate">{c.name}</span>
                  </button>
                </li>
              ))}
              {!loading && filtered.length === 0 && <li className="p-2 text-xs text-muted-foreground">No results</li>}
            </ul>
          </div>
        )}
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
