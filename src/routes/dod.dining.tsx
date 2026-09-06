/** DOD Dining — configure menus, schedules, view dining exceptions */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Utensils } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { diningApi, type DiningMenu, type DiningSchedule } from "@/lib/boardingApi";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dod/dining")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodDiningPage,
});

type Dormitory = { id: string; name: string };
const TABS = ["Menus", "Schedules"] as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

function DodDiningPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Menus");
  const [menus, setMenus] = useState<DiningMenu[]>([]);
  const [schedules, setSchedules] = useState<DiningSchedule[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuType, setMenuType] = useState("weekly");
  const [schedForm, setSchedForm] = useState({ dormitory_id: "", meal_type: "breakfast" as typeof MEALS[number], start_time: "06:30", end_time: "07:30" });

  const load = async () => {
    setLoading(true);
    try {
      const [m, s, d] = await Promise.all([
        diningApi.listMenus(),
        diningApi.listSchedules(),
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }),
      ]);
      setMenus(Array.isArray(m) ? m : []);
      setSchedules(Array.isArray(s) ? s : []);
      setDormitories(Array.isArray(d) ? d : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load dining data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await diningApi.createMenu({ name: menuName, menu_type: menuType });
      toast.success("Menu created");
      setShowMenu(false);
      setMenuName("");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create menu"); }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await diningApi.createSchedule({ scope: "dormitory", dormitory_id: schedForm.dormitory_id || undefined, meal_type: schedForm.meal_type, start_time: schedForm.start_time, end_time: schedForm.end_time });
      toast.success("Dining schedule created");
      setShowSchedule(false);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create schedule"); }
  };

  const mealColor = (meal: string) => {
    if (meal === "breakfast") return "bg-amber-100 text-amber-700";
    if (meal === "lunch") return "bg-blue-100 text-blue-700";
    if (meal === "dinner") return "bg-indigo-100 text-indigo-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <DodLayout title="Dining Management" subtitle="Manage meal menus and dormitory dining schedules">
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Menus" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Create weekly, monthly, or term menus. Patrons see these in their dining panel.</p>
            <button onClick={() => setShowMenu(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Create Menu
            </button>
          </div>
          {loading ? <Skeleton className="h-40" /> : menus.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No menus yet. Create a weekly menu to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {menus.map(m => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{m.name}</span>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{m.menu_type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.start_date && m.end_date ? `${m.start_date} – ${m.end_date}` : "No date range set"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{m.items?.length ?? 0} menu items</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Schedules" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Define meal timing per dormitory. Patrons/Matrons see these as the expected dining sessions for their students.</p>
            <button onClick={() => setShowSchedule(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Schedule
            </button>
          </div>
          {loading ? <Skeleton className="h-40" /> : schedules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No dining schedules yet. Click "Add Schedule" to configure meal timings.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Dormitory", "Meal", "Start", "End", "Days", "Status"].map(h => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">{s.dormitory?.name ?? "All"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${mealColor(s.meal_type)}`}>
                          {s.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.start_time}</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.end_time}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.applicable_days}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-4">Create Dining Menu</h2>
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Menu Name *</label>
                <input value={menuName} onChange={e => setMenuName(e.target.value)} required placeholder="e.g. Term 1 Weekly Menu"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Type</label>
                <select value={menuType} onChange={e => setMenuType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="term">Term</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90">Create</button>
                <button type="button" onClick={() => setShowMenu(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-4">Add Dining Schedule</h2>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Dormitory (optional)</label>
                <select value={schedForm.dormitory_id} onChange={e => setSchedForm(p => ({ ...p, dormitory_id: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">All Dormitories</option>
                  {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Meal Type</label>
                <select value={schedForm.meal_type} onChange={e => setSchedForm(p => ({ ...p, meal_type: e.target.value as typeof MEALS[number] }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {MEALS.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Start Time</label>
                  <input type="time" value={schedForm.start_time} onChange={e => setSchedForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">End Time</label>
                  <input type="time" value={schedForm.end_time} onChange={e => setSchedForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90">Save Schedule</button>
                <button type="button" onClick={() => setShowSchedule(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DodLayout>
  );
}
