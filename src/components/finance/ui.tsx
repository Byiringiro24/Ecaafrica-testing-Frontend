import { ReactNode, useRef, useState } from "react";
import { X, Upload, FileText, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Shared Finance UI: modal dialog, form fields, file upload + document viewer.
// Frontend-only — uploaded files are kept in memory via object URLs so they can
// be viewed in a new tab without any backend.
// ============================================================================

export interface UploadedDoc {
  name: string;
  url?: string;      // object URL for a real uploaded file
  size?: number;     // bytes
  type?: string;     // mime
  seed?: boolean;    // true for mock/seed documents that have no real file
  title?: string;    // used to render a placeholder for seed docs
}

// Open a document in a new tab. Real uploads open their object URL; seed docs
// get a generated placeholder page so "view" works everywhere.
export function openDocument(doc: UploadedDoc) {
  if (doc.url) {
    window.open(doc.url, "_blank", "noopener");
    return;
  }
  const title = doc.title || doc.name || "Document";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f1f5f9;margin:0;padding:40px;color:#0f172a}
    .sheet{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:48px;box-shadow:0 10px 30px rgba(0,0,0,.08)}
    .badge{display:inline-block;background:#3b5998;color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px}
    h1{font-size:22px;margin:18px 0 6px}.muted{color:#64748b;font-size:13px}
    .row{display:flex;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding:10px 0;font-size:14px}
    .stamp{margin-top:40px;border:2px dashed #cbd5e1;border-radius:10px;text-align:center;color:#94a3b8;padding:22px;font-size:13px}</style></head>
    <body><div class="sheet"><span class="badge">Education Care System · Finance</span>
    <h1>${title}</h1><p class="muted">Sample supporting document (frontend preview — no file was attached to this seeded record).</p>
    <div class="row"><span>Document</span><strong>${doc.name}</strong></div>
    <div class="row"><span>Type</span><strong>${doc.type || "application/pdf"}</strong></div>
    <div class="row"><span>Status</span><strong>Verified</strong></div>
    <div class="stamp">School stamp &amp; authorised signature</div></div></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank", "noopener");
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

export function SelectField({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[]; required?: boolean;
}) {
  return (
    <FormField label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
        {options.map((o) => <option key={o}>{o}</option>)}
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
    onChange({ name: file.name, url: URL.createObjectURL(file), size: file.size, type: file.type });
  };

  return (
    <FormField label={label} hint="PDF, image or Office document. Stored locally for preview.">
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

// Inline "view document" button for table rows (uploaded or seed docs)
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
