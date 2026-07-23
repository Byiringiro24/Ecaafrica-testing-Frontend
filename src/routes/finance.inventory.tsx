import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  Modal, TextField, SelectField, FileInput, DocButton, PrimaryButton, GhostButton,
  type UploadedDoc,
} from "@/components/finance/ui";
import { INVENTORY_ITEMS, SUPPLIERS, formatRWF, type InventoryItem, type Supplier, type POStatus } from "@/lib/financeData";

export const Route = createFileRoute("/finance/inventory")({ component: InventoryPage });

const TABS = ["Stock & Valuation", "Suppliers"] as const;

type InventoryRow = InventoryItem & { invoice?: UploadedDoc };

const STATUS_TONE: Record<POStatus, "success" | "warning" | "destructive" | "muted" | "primary"> = {
  Received: "success", Invoiced: "primary", Ordered: "warning", Requested: "muted", Cancelled: "destructive",
};

const SEEDED: InventoryRow[] = INVENTORY_ITEMS.map((it) =>
  it.status === "Invoiced" || it.status === "Received"
    ? { ...it, invoice: { name: `${it.id}-supplier-invoice.pdf`, seed: true, title: `Supplier Invoice — ${it.item}`, type: "application/pdf" } }
    : it,
);

function InventoryPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Stock & Valuation");
  const [items, setItems] = useState<InventoryRow[]>(SEEDED);
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS);
  const [addingItem, setAddingItem] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);

  const totalValue = items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
  const lowStock = items.filter((it) => it.quantity < it.reorderLevel).length;
  const payable = suppliers.reduce((s, sup) => s + sup.balance, 0);

  const addItem = (it: InventoryRow) => {
    setItems((prev) => [it, ...prev]);
    setAddingItem(false);
    toast.success(`Purchase request ${it.id} created for ${it.item}`);
  };
  const addSupplier = (s: Supplier) => {
    setSuppliers((prev) => [s, ...prev]);
    setAddingSupplier(false);
    toast.success(`Supplier "${s.name}" added`);
  };

  return (
    <FinanceLayout title="Inventory &amp; Procurement" subtitle="Purchases, stock valuation & supplier balances">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Stock Value" value={formatRWF(totalValue)} />
        <StatCard compact label="Line Items" value={items.length} />
        <StatCard compact label="Low Stock" value={lowStock} tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
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
        <StockTab items={items} onNew={() => setAddingItem(true)} />
      ) : (
        <SuppliersTab suppliers={suppliers} onNew={() => setAddingSupplier(true)} />
      )}

      {addingItem && <PurchaseRequestModal nextIndex={items.length} suppliers={suppliers} onClose={() => setAddingItem(false)} onCreate={addItem} />}
      {addingSupplier && <AddSupplierModal nextIndex={suppliers.length} onClose={() => setAddingSupplier(false)} onCreate={addSupplier} />}
    </FinanceLayout>
  );
}

function StockTab({ items, onNew }: { items: InventoryRow[]; onNew: () => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">Purchase requests → orders → goods received → valuation</div>
        <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Purchase Request
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Item", "Category", "Supplier", "Qty", "Unit Cost", "Value", "Invoice", "Status"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {items.map((it) => {
                const low = it.quantity < it.reorderLevel;
                return (
                  <tr key={it.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{it.item}<div className="text-[11px] text-muted-foreground">{it.id}</div></td>
                    <td className="px-4 py-3"><StatusPill label={it.category} tone="muted" /></td>
                    <td className="px-4 py-3 text-xs">{it.supplier}</td>
                    <td className={`px-4 py-3 font-semibold ${low ? "text-destructive" : ""}`}>{it.quantity}{low && <AlertTriangle className="inline h-3.5 w-3.5 ml-1" />}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(it.unitCost)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{formatRWF(it.quantity * it.unitCost)}</td>
                    <td className="px-4 py-3"><DocButton doc={it.invoice ?? null} /></td>
                    <td className="px-4 py-3"><StatusPill label={it.status} tone={STATUS_TONE[it.status]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SuppliersTab({ suppliers, onNew }: { suppliers: Supplier[]; onNew: () => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">Supplier directory & outstanding balances</div>
        <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Supplier
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Supplier", "Category", "Contact", "Phone", "Outstanding Balance"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{s.name}<div className="text-[11px] text-muted-foreground">{s.id}</div></td>
                <td className="px-4 py-3"><StatusPill label={s.category} tone="muted" /></td>
                <td className="px-4 py-3">{s.contact}</td>
                <td className="px-4 py-3 text-xs">{s.phone}</td>
                <td className={`px-4 py-3 font-mono text-xs font-semibold ${s.balance > 0 ? "text-destructive" : "text-success"}`}>{s.balance > 0 ? formatRWF(s.balance) : "Settled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PO_STATUSES: POStatus[] = ["Requested", "Ordered", "Received", "Invoiced"];

function PurchaseRequestModal({ nextIndex, suppliers, onClose, onCreate }: { nextIndex: number; suppliers: Supplier[]; onClose: () => void; onCreate: (it: InventoryRow) => void }) {
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("Stationery");
  const [supplier, setSupplier] = useState(suppliers[0]?.name ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [status, setStatus] = useState<POStatus>("Requested");
  const [invoice, setInvoice] = useState<UploadedDoc | null>(null);

  const n = (v: string) => parseInt(v.replace(/\D/g, "")) || 0;
  const value = n(quantity) * n(unitCost);

  const submit = () => {
    if (!item.trim()) { toast.error("Enter an item name"); return; }
    if (n(quantity) <= 0 || n(unitCost) <= 0) { toast.error("Enter valid quantity and unit cost"); return; }
    onCreate({
      id: `INV-${200 + nextIndex}`,
      item: item.trim(),
      category,
      supplier,
      quantity: n(quantity),
      unitCost: n(unitCost),
      reorderLevel: n(reorderLevel),
      status,
      invoice: invoice ?? undefined,
    });
  };

  return (
    <Modal title="New Purchase Request" subtitle="Add a procurement line item & optional supplier invoice" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Create Request ({formatRWF(value)})</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Item Name" value={item} onChange={setItem} placeholder="e.g. A4 Paper (ream)" required />
        <SelectField label="Category" value={category} onChange={setCategory} options={["Stationery", "Laboratory", "ICT Equipment", "Catering", "Cleaning", "Maintenance"]} />
        <SelectField label="Supplier" value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} />
        <SelectField label="Status" value={status} onChange={(v) => setStatus(v as POStatus)} options={PO_STATUSES} />
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

function AddSupplierModal({ nextIndex, onClose, onCreate }: { nextIndex: number; onClose: () => void; onCreate: (s: Supplier) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Stationery");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState("");

  const submit = () => {
    if (!name.trim()) { toast.error("Enter supplier name"); return; }
    onCreate({
      id: `SUP-${String(nextIndex + 1).padStart(2, "0")}`,
      name: name.trim(),
      category,
      contact: contact.trim() || "—",
      phone: phone.trim() || "—",
      balance: parseInt(balance.replace(/\D/g, "")) || 0,
    });
  };

  return (
    <Modal title="Add Supplier" onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Add Supplier</PrimaryButton></>}>
      <TextField label="Supplier Name" value={name} onChange={setName} placeholder="Company name" required />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Category" value={category} onChange={setCategory} options={["Stationery", "Laboratory", "ICT Equipment", "Catering", "Cleaning", "Maintenance"]} />
        <TextField label="Contact Person" value={contact} onChange={setContact} placeholder="Full name" />
        <TextField label="Phone" value={phone} onChange={setPhone} placeholder="+250 7.. ... ..." />
        <TextField label="Opening Balance (RWF)" value={balance} onChange={setBalance} placeholder="0" />
      </div>
    </Modal>
  );
}
