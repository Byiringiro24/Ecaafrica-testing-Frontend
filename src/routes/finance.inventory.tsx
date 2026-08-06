import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal, TextField, SelectField, FileInput, DocButton, PrimaryButton, GhostButton,
  type UploadedDoc,
} from "@/components/finance/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  formatRWF, toNum,
  listInventory, createInventoryItem, setInventoryStatus, uploadInventoryInvoice,
  listSuppliers, createSupplier,
  type InventoryItem, type Supplier, type POStatus,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/inventory")({ component: InventoryPage });

const TABS = ["Stock & Valuation", "Suppliers"] as const;

const STATUS_TONE: Record<POStatus, "success" | "warning" | "destructive" | "muted" | "primary"> = {
  received: "success", invoiced: "primary", ordered: "warning", requested: "muted", cancelled: "destructive",
};

const STATUS_LABEL: Record<POStatus, string> = {
  received: "Received", invoiced: "Invoiced", ordered: "Ordered", requested: "Requested", cancelled: "Cancelled",
};

// The lifecycle only moves forward; these are the transitions the API accepts.
const NEXT_STATUS: Partial<Record<POStatus, POStatus[]>> = {
  requested: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
};

const CATEGORIES = ["Stationery", "Laboratory", "ICT Equipment", "Catering", "Cleaning", "Maintenance"];

const docUrl = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE_URL.replace(/\/api\/v1$/, "")}${url}`;

const STOCK_HEADERS = ["Item", "Category", "Supplier", "Qty", "Unit Cost", "Value", "Invoice", "Status", "Action"];
const SUPPLIER_HEADERS = ["Supplier", "Category", "Contact", "Phone", "Outstanding Balance"];

function InventoryPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Stock & Valuation");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stockMeta, setStockMeta] = useState<{ total: number; stock_value: string; low_stock_count: number } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payable, setPayable] = useState<string>("0");
  const [addingItem, setAddingItem] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [confirming, setConfirming] = useState<{ item: InventoryItem; status: POStatus } | null>(null);
  const [receipt, setReceipt] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryRes, supplierRes] = await Promise.all([
        listInventory({ limit: 100 }),
        listSuppliers({ limit: 100 }),
      ]);
      setItems(inventoryRes.data);
      setStockMeta(inventoryRes.meta);
      setSuppliers(supplierRes.data);
      setPayable(supplierRes.meta.total_payable);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (item: InventoryItem, status: POStatus) => {
    try {
      await setInventoryStatus(item.id, status);
      toast.success(`${item.item_name} marked ${STATUS_LABEL[status]}`);
      if (status === "received") setReceipt(item);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update status");
    }
  };

  return (
    <FinanceLayout title="Inventory &amp; Procurement" subtitle="Purchases, stock valuation & supplier balances">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Stock Value" value={formatRWF(stockMeta?.stock_value)} />
        <StatCard compact label="Line Items" value={stockMeta?.total ?? 0} />
        <StatCard compact label="Low Stock" value={stockMeta?.low_stock_count ?? 0} tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard compact label="Supplier Payable" value={formatRWF(payable)} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Stock & Valuation" ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">Purchase requests → orders → goods received → valuation</div>
            <button onClick={() => setAddingItem(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Purchase Request
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{STOCK_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} className="border-t border-border"><td colSpan={STOCK_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                    ))
                  ) : error ? (
                    <tr><td colSpan={STOCK_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={STOCK_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No inventory items yet.</td></tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{it.item_name}<div className="text-[11px] text-muted-foreground">{it.code}</div></td>
                        <td className="px-4 py-3">{it.category ? <StatusPill label={it.category} tone="muted" /> : "--"}</td>
                        <td className="px-4 py-3 text-xs">{it.supplier_name ?? "--"}</td>
                        <td className={`px-4 py-3 font-semibold ${it.is_low_stock ? "text-destructive" : ""}`}>{it.quantity}{it.is_low_stock && <AlertTriangle className="inline h-3.5 w-3.5 ml-1" />}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatRWF(it.unit_cost)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{formatRWF(it.total_value)}</td>
                        <td className="px-4 py-3"><DocButton doc={it.invoice_url ? { name: `${it.code}-invoice`, url: docUrl(it.invoice_url) } : null} /></td>
                        <td className="px-4 py-3"><StatusPill label={STATUS_LABEL[it.status]} tone={STATUS_TONE[it.status]} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {(NEXT_STATUS[it.status] ?? []).map((next) => (
                              <button key={next} onClick={() => setConfirming({ item: it, status: next })}
                                className={`text-xs font-semibold hover:underline ${next === "cancelled" ? "text-destructive" : "text-primary"}`}>
                                {STATUS_LABEL[next]}
                              </button>
                            ))}
                            {!(NEXT_STATUS[it.status] ?? []).length && <span className="text-xs text-muted-foreground">--</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">Supplier directory & outstanding balances</div>
            <button onClick={() => setAddingSupplier(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{SUPPLIER_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <tr key={i} className="border-t border-border"><td colSpan={SUPPLIER_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={SUPPLIER_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No suppliers yet.</td></tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium">{s.name}<div className="text-[11px] text-muted-foreground">{s.code}</div></td>
                      <td className="px-4 py-3">{s.category ? <StatusPill label={s.category} tone="muted" /> : "--"}</td>
                      <td className="px-4 py-3">{s.contact_person ?? "--"}</td>
                      <td className="px-4 py-3 text-xs">{s.phone ?? "--"}</td>
                      <td className={`px-4 py-3 font-mono text-xs font-semibold ${toNum(s.balance) > 0 ? "text-destructive" : "text-success"}`}>{toNum(s.balance) > 0 ? formatRWF(s.balance) : "Settled"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addingItem && (
        <PurchaseRequestModal
          suppliers={suppliers}
          onClose={() => setAddingItem(false)}
          onCreated={async () => { setAddingItem(false); await load(); }}
        />
      )}
      {addingSupplier && (
        <AddSupplierModal
          onClose={() => setAddingSupplier(false)}
          onCreated={async () => { setAddingSupplier(false); await load(); }}
        />
      )}
      {confirming && (
        <ConfirmStatusModal
          item={confirming.item}
          status={confirming.status}
          onClose={() => setConfirming(null)}
          onConfirm={async () => { await advance(confirming.item, confirming.status); setConfirming(null); }}
        />
      )}
      {receipt && (
        <OrderReceiptModal item={receipt} onClose={() => setReceipt(null)} />
      )}
    </FinanceLayout>
  );
}

function PurchaseRequestModal({
  suppliers,
  onClose,
  onCreated,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [itemName, setItemName] = useState("");
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [invoice, setInvoice] = useState<UploadedDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const confirmNewCategory = () => {
    const name = newCategory.trim();
    if (!name) { toast.error("Enter a category name"); return; }
    const existing = categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategory(existing);
    } else {
      setCategories((prev) => [...prev, name]);
      setCategory(name);
    }
    setNewCategory("");
    setAddingCategory(false);
  };

  const filteredSuppliers = supplierSearch.trim()
    ? suppliers.filter((s) =>
        `${s.name} ${s.code ?? ""} ${s.category ?? ""}`.toLowerCase().includes(supplierSearch.toLowerCase())
      )
    : suppliers;

  const n = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  const value = n(quantity) * n(unitCost);

  const submit = async () => {
    if (!itemName.trim()) { toast.error("Enter an item name"); return; }
    if (n(quantity) <= 0 || n(unitCost) <= 0) { toast.error("Enter valid quantity and unit cost"); return; }

    setSubmitting(true);
    try {
      const created = await createInventoryItem({
        item_name: itemName.trim(),
        quantity: Math.round(n(quantity)),
        unit_cost: n(unitCost),
        category,
        supplier_id: supplierId || undefined,
        reorder_level: Math.round(n(reorderLevel)),
      });

      if (invoice?.file) {
        await uploadInventoryInvoice(created.id, invoice.file);
      }

      toast.success(`Purchase request ${created.code} created for ${created.item_name}`);
      await onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create purchase request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New Purchase Request" subtitle="Add a procurement line item & optional supplier invoice" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Creating..." : `Create Request (${formatRWF(value)})`}</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Item Name" value={itemName} onChange={setItemName} placeholder="e.g. A4 Paper (ream)" required />
        <div>
          {addingCategory ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Category</label>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewCategory(); } }}
                  placeholder="e.g. Sports Equipment"
                  autoFocus
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
                <button type="button" onClick={confirmNewCategory} className="rounded-lg bg-primary text-primary-foreground px-3 text-sm font-semibold hover:bg-primary/90">Add</button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategory(""); }} className="rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <SelectField label="Category" value={category} onChange={setCategory} options={categories} />
              <button type="button" onClick={() => setAddingCategory(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="h-3 w-3" /> New category
              </button>
            </>
          )}
        </div>
        <div className="relative">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Supplier</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={supplierSearch}
              onChange={(e) => { setSupplierSearch(e.target.value); setSupplierId(""); setShowSupplierDropdown(true); }}
              onFocus={() => setShowSupplierDropdown(true)}
              onBlur={() => setShowSupplierDropdown(false)}
              placeholder="Search supplier..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          {showSupplierDropdown && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
              {filteredSuppliers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No suppliers match "{supplierSearch}".</div>
              ) : (
                filteredSuppliers.slice(0, 50).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => { setSupplierId(s.id); setSupplierSearch(s.name); setShowSupplierDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    {s.name}
                    {s.code && <span className="text-[11px] text-muted-foreground"> · {s.code}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <TextField label="Quantity" value={quantity} onChange={setQuantity} placeholder="20" required />
        <TextField label="Unit Cost (RWF)" value={unitCost} onChange={setUnitCost} placeholder="6500" required />
        <TextField label="Reorder Level" value={reorderLevel} onChange={setReorderLevel} placeholder="10" />
      </div>
      <div className="rounded-lg bg-muted/40 p-3 text-sm flex justify-between">
        <span className="text-muted-foreground">Total Value</span>
        <span className="font-display font-bold text-primary">{formatRWF(value)}</span>
      </div>
      <FileInput label="Supplier Invoice (optional)" value={invoice} onChange={setInvoice} />
    </Modal>
  );
}

function ConfirmStatusModal({
  item,
  status,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  status: POStatus;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isCancelling = status === "cancelled";

  return (
    <Modal
      title={`Confirm: ${STATUS_LABEL[status]}`}
      subtitle={`${item.item_name} · ${item.code}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={async () => { setSubmitting(true); await onConfirm(); setSubmitting(false); }}>
            {submitting ? "Updating..." : `Yes, mark ${STATUS_LABEL[status]}`}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-sm">
        {isCancelling
          ? `Are you sure you want to cancel the purchase request for "${item.item_name}"? This cannot be undone.`
          : `Mark "${item.item_name}" as ${STATUS_LABEL[status]}?`}
      </p>
      {isCancelling && (
        <p className="text-xs text-destructive font-semibold">This will cancel the order permanently.</p>
      )}
    </Modal>
  );
}

function OrderReceiptModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  return (
    <Modal
      title="Order Receipt"
      subtitle={`Goods received — ${item.item_name}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton onClick={() => window.print()}>Print Receipt</PrimaryButton>
        </>
      }
    >
      <div className="invoice-print space-y-3 text-sm">
        <div className="flex justify-between border-b border-border pb-2">
          <span className="font-bold text-base">Goods Received Note</span>
          <span className="text-muted-foreground text-xs">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-muted-foreground">Item</span><div className="font-semibold">{item.item_name}</div></div>
          <div><span className="text-muted-foreground">Code</span><div className="font-mono text-xs">{item.code}</div></div>
          <div><span className="text-muted-foreground">Category</span><div>{item.category ?? "--"}</div></div>
          <div><span className="text-muted-foreground">Supplier</span><div>{item.supplier_name ?? "--"}</div></div>
          <div><span className="text-muted-foreground">Quantity</span><div className="font-semibold">{item.quantity}</div></div>
          <div><span className="text-muted-foreground">Unit Cost</span><div className="font-mono">{formatRWF(item.unit_cost)}</div></div>
          <div className="col-span-2 border-t border-border pt-2 flex justify-between">
            <span className="font-bold">Total Value</span>
            <span className="font-display font-bold text-primary">{formatRWF(item.total_value)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Received by (signature &amp; stamp)</div>
      </div>
    </Modal>
  );
}

function AddSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Enter supplier name"); return; }
    setSubmitting(true);
    try {
      const created = await createSupplier({
        name: name.trim(),
        category,
        contact_person: contact.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        balance: Number(balance.replace(/[^\d.]/g, "")) || 0,
      });
      toast.success(`Supplier "${created.name}" added`);
      await onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add supplier");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add Supplier" onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Adding..." : "Add Supplier"}</PrimaryButton></>}>
      <TextField label="Supplier Name" value={name} onChange={setName} placeholder="Company name" required />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
        <TextField label="Contact Person" value={contact} onChange={setContact} placeholder="Full name" />
        <TextField label="Phone" value={phone} onChange={setPhone} placeholder="+250 7.. ... ..." />
        <TextField label="Email" value={email} onChange={setEmail} placeholder="supplier@example.com" />
        <TextField label="Opening Balance (RWF)" value={balance} onChange={setBalance} placeholder="0" />
      </div>
    </Modal>
  );
}
