import { ReactNode, useRef, useState } from "react";
import { X, Upload, FileText, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Shared Finance UI: modal dialog, form fields, file upload + document viewer.
// Uploads keep the underlying File so the caller can POST it to the backend;
// documents already stored server-side are opened from their returned URL.
// ============================================================================

export interface UploadedDoc {
  name: string;
  url?: string;      // object URL for a pending upload, or the stored server URL
  size?: number;     // bytes
  type?: string;     // mime
  file?: File;       // present until the document has been sent to the backend
}

// Open a document in a new tab. Pending uploads open their object URL; stored
// documents open the URL the backend returned.
export function openDocument(doc: UploadedDoc) {
  if (doc.url) {
    window.open(doc.url, "_blank", "noopener");
  }
}

function humanSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Modal dialog
// ---------------------------------------------------------------------------
export function Modal({ title, subtitle, onClose, children, footer, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={cn("bg-card rounded-2xl shadow-2xl w-full max-h-[92vh] overflow-y-auto", wide ? "max-w-3xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-display font-bold text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export function FormField({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}{required && <span className="text-destructive"> *</span>}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, type = "text", required, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; disabled?: boolean; hint?: string;
}) {
  return (
    <FormField label={label} required={required} hint={hint}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
    </FormField>
  );
}

export function SelectField({ label, value, onChange, options, optionLabels, required }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
  optionLabels?: Record<string, string>; required?: boolean;
}) {
  return (
    <FormField label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
        {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </FormField>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <FormField label={label}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
    </FormField>
  );
}

// ---------------------------------------------------------------------------
// File upload (object URL) with inline preview + view
// ---------------------------------------------------------------------------
export function FileInput({ label = "Attach Document", value, onChange, accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" }: {
  label?: string; value: UploadedDoc | null; onChange: (d: UploadedDoc | null) => void; accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const take = (file?: File | null) => {
    if (!file) return;
    onChange({ name: file.name, url: URL.createObjectURL(file), size: file.size, type: file.type, file });
  };

  return (
    <FormField label={label} hint="PDF, image or Office document, up to 5 MB.">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{value.name}</div>
            <div className="text-[11px] text-muted-foreground">{humanSize(value.size)}</div>
          </div>
          <button type="button" onClick={() => openDocument(value)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"><Eye className="h-3.5 w-3.5" /> View</button>
          <button type="button" onClick={() => onChange(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30")}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm font-medium">Click to upload or drag &amp; drop</div>
          <div className="text-[11px] text-muted-foreground">Supporting document (optional)</div>
        </div>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => take(e.target.files?.[0])} />
    </FormField>
  );
}

// Inline "view document" button for table rows
export function DocButton({ doc, label = "View" }: { doc: UploadedDoc | null; label?: string }) {
  if (!doc) return <span className="text-muted-foreground">—</span>;
  return (
    <button onClick={() => openDocument(doc)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
      <Eye className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function PrimaryButton({ children, onClick, type = "button" }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">{children}</button>;
}
export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{children}</button>;
}
