import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  createExamType, createGradingRole, listExamTypes, listGradingRoles,
  updateExamType, updateGradingRole, type ExamTypeOption, type GradingRole
} from "@/lib/exam-configuration-api";

const inputClass = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";

export function ExamTypesPanel() {
  const [items, setItems] = useState<ExamTypeOption[]>([]);
  const [editing, setEditing] = useState<ExamTypeOption | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => { try { setItems(await listExamTypes(true)); } catch (error: any) { toast.error(error?.message ?? "Failed to load exam types"); } };
  useEffect(() => { load(); }, []);
  const reset = () => { setEditing(null); setName(""); setDescription(""); };
  const edit = (item: ExamTypeOption) => { setEditing(item); setName(item.name); setDescription(item.description ?? ""); };
  const save = async () => {
    if (!name.trim()) return toast.error("Exam type name is required");
    try { setSaving(true); if (editing) await updateExamType(editing.id, { name: name.trim(), description: description.trim() }); else await createExamType({ name: name.trim(), description: description.trim() }); toast.success(editing ? "Exam type updated" : "Exam type created"); reset(); await load(); }
    catch (error: any) { toast.error(error?.message ?? "Failed to save exam type"); } finally { setSaving(false); }
  };
  const toggle = async (item: ExamTypeOption) => { try { await updateExamType(item.id, { is_active: !item.is_active }); await load(); } catch (error: any) { toast.error(error?.message ?? "Failed to update exam type"); } };

  return <ConfigurationShell title="Exam types" description="Define the assessment types teachers can choose when scheduling an exam." count={`${items.length} configured`}>
    <ConfigurationForm title={editing ? "Update exam type" : "Add exam type"} editing={Boolean(editing)} onCancel={editing ? reset : undefined}>
      <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mid-term test" /></Field>
      <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional explanation for teachers" /></Field>
      <SaveButton saving={saving} label={editing ? "Update exam type" : "Create exam type"} onClick={save} />
    </ConfigurationForm>
    <ItemList empty="No custom exam types yet. Add one above to make it available to teachers." items={items} render={(item) => <div className="flex items-center justify-between gap-4"><div><div className="font-semibold">{item.name}</div><div className="text-sm text-muted-foreground">{item.description || "No description"}</div></div><div className="flex items-center gap-2"><button onClick={() => toggle(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.is_active ? "Active" : "Inactive"}</button><button onClick={() => edit(item)} className="rounded-lg border border-border p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button></div></div>} />
  </ConfigurationShell>;
}

export function GradingRolesPanel() {
  const [items, setItems] = useState<GradingRole[]>([]);
  const [editing, setEditing] = useState<GradingRole | null>(null);
  const [form, setForm] = useState({ code: "", label: "", min_percentage: "", max_percentage: "", sort_order: "0" });
  const [saving, setSaving] = useState(false);
  const load = async () => { try { setItems(await listGradingRoles(true)); } catch (error: any) { toast.error(error?.message ?? "Failed to load grading roles"); } };
  useEffect(() => { load(); }, []);
  const reset = () => { setEditing(null); setForm({ code: "", label: "", min_percentage: "", max_percentage: "", sort_order: "0" }); };
  const edit = (item: GradingRole) => { setEditing(item); setForm({ code: item.code, label: item.label, min_percentage: item.min_percentage, max_percentage: item.max_percentage, sort_order: String(item.sort_order) }); };
  const save = async () => {
    const min = Number(form.min_percentage), max = Number(form.max_percentage);
    if (!form.code.trim() || !form.label.trim() || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) return toast.error("Enter a valid code, label, and percentage range");
    try { setSaving(true); const data = { code: form.code.trim(), label: form.label.trim(), min_percentage: min, max_percentage: max, sort_order: Number(form.sort_order) || 0 }; if (editing) await updateGradingRole(editing.id, data); else await createGradingRole(data); toast.success(editing ? "Grading role updated" : "Grading role created"); reset(); await load(); }
    catch (error: any) { toast.error(error?.message ?? "Failed to save grading role"); } finally { setSaving(false); }
  };
  const toggle = async (item: GradingRole) => { try { await updateGradingRole(item.id, { is_active: !item.is_active }); await load(); } catch (error: any) { toast.error(error?.message ?? "Failed to update grading role"); } };
  return <ConfigurationShell title="Grading roles" description="Set the percentage ranges and labels used when teachers record marks." count={`${items.length} configured`}>
    <ConfigurationForm title={editing ? "Update grading role" : "Add grading role"} editing={Boolean(editing)} onCancel={editing ? reset : undefined}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Code"><input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A" /></Field><Field label="Label"><input className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Excellent" /></Field><Field label="Minimum %"><input type="number" min="0" max="100" className={inputClass} value={form.min_percentage} onChange={(e) => setForm({ ...form, min_percentage: e.target.value })} placeholder="80" /></Field><Field label="Maximum %"><input type="number" min="0" max="100" className={inputClass} value={form.max_percentage} onChange={(e) => setForm({ ...form, max_percentage: e.target.value })} placeholder="100" /></Field></div>
      <SaveButton saving={saving} label={editing ? "Update grading role" : "Create grading role"} onClick={save} />
    </ConfigurationForm>
    <ItemList empty="No grading roles yet. Add ranges such as A / Excellent / 80–100 above." items={items} render={(item) => <div className="flex items-center justify-between gap-4"><div><div className="font-semibold"><span className="mr-2 rounded bg-indigo-50 px-2 py-1 text-indigo-700">{item.code}</span>{item.label}</div><div className="mt-1 text-sm text-muted-foreground">{item.min_percentage}% – {item.max_percentage}%</div></div><div className="flex items-center gap-2"><button onClick={() => toggle(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.is_active ? "Active" : "Inactive"}</button><button onClick={() => edit(item)} className="rounded-lg border border-border p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button></div></div>} />
  </ConfigurationShell>;
}

function ConfigurationShell({ title, description, count, children }: { title: string; description: string; count: string; children: React.ReactNode }) { return <div className="space-y-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{count}</span></div>{children}</div>; }
function ConfigurationForm({ title, editing, onCancel, children }: { title: string; editing: boolean; onCancel?: () => void; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-display text-lg font-bold">{title}</h3><p className="text-sm text-muted-foreground">Only school administrators can change these settings.</p></div>{editing && <button onClick={onCancel} className="rounded-lg border border-border p-2 hover:bg-muted"><X className="h-4 w-4" /></button>}</div><div className="space-y-4">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium">{label}<span className="mt-1 block">{children}</span></label>; }
function SaveButton({ saving, label, onClick }: { saving: boolean; label: string; onClick: () => void }) { return <button onClick={onClick} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{label}</button>; }
function ItemList<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4"><h3 className="font-display text-lg font-bold">Configured values</h3><p className="text-sm text-muted-foreground">Changes are available to teachers immediately.</p></div>{items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{empty}</p> : <div className="divide-y divide-border">{items.map((item, index) => <div key={index} className="py-4 first:pt-0 last:pb-0">{render(item)}</div>)}</div>}</section>; }
