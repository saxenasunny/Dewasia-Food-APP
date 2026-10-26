import { useEffect, useMemo, useState } from "react";
import { OperatorShell } from "../../components/layout/OperatorShell";
import { Button, Card, Input, Pill } from "../../components/ui/Primitives";
import { ErrorState, LoadingState } from "../../components/ui/Feedback";
import { useCanteen } from "../../hooks/useCanteen";
import { useMenu } from "../../hooks/useMenu";
import { useToast } from "../../components/ui/Toast";
import { requireSupabase } from "../../lib/supabase";
import { formatMoney } from "../../lib/formatters";
import type { MenuItem } from "../../types";

type Editing = { id: string; name: string; description: string; price: string } | null;

export default function MenuManagementPage() {
  const { canteen } = useCanteen();
  const { categories, items, loading, error, reload } = useMenu(canteen?.id);
  const { notify } = useToast();

  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!newCategory && categories.length > 0) setNewCategory(categories[0].id);
  }, [categories, newCategory]);

  const grouped = useMemo(() => categories, [categories]);

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const supabase = requireSupabase();
      const { error: err } = await supabase
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", item.id);
      if (err) throw new Error(err.message);
      notify(
        `${item.name} is now ${!item.is_available ? "available" : "sold out"}.`,
        "success",
      );
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not update availability.", "error");
    }
  };

  const startEdit = (item: MenuItem) => {
    setEditing({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(editing.price);
    if (!editing.name.trim()) {
      notify("Name is required.", "error");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      notify("Enter a valid price.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = requireSupabase();
      const { error: err } = await supabase
        .from("menu_items")
        .update({
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          price,
        })
        .eq("id", editing.id);
      if (err) throw new Error(err.message);
      notify("Item saved.", "success");
      setEditing(null);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save the item.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    if (!canteen || !newName.trim()) {
      notify("Enter an item name.", "error");
      return;
    }
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price < 0) {
      notify("Enter a valid price.", "error");
      return;
    }
    setAdding(true);
    try {
      const supabase = requireSupabase();
      const { error: err } = await supabase.from("menu_items").insert({
        canteen_id: canteen.id,
        category_id: newCategory,
        name: newName.trim(),
        description: null,
        price,
        sort_order: items.length + 1,
      });
      if (err) throw new Error(err.message);
      notify(`${newName.trim()} added to the menu.`, "success");
      setNewName("");
      setNewPrice("");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add the item.", "error");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <OperatorShell title="Menu manager" subtitle="Loading">
        <LoadingState label="Loading the menu" />
      </OperatorShell>
    );
  }

  if (error) {
    return (
      <OperatorShell title="Menu manager">
        <ErrorState description={error} onRetry={reload} />
      </OperatorShell>
    );
  }

  return (
    <OperatorShell title="Menu manager" subtitle="Availability, prices and items">
      <div className="space-y-6">
        <Card className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Add an item</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Item name"
              aria-label="Item name"
              className="sm:col-span-2"
            />
            <Input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Price (INR)"
              inputMode="decimal"
              aria-label="Price in rupees"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              aria-label="Category"
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none"
            >
              {grouped.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button loading={adding} onClick={() => void addItem()}>
            Add to menu
          </Button>
        </Card>

        {grouped.map((category) => (
          <section key={category.id}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">
              {category.name}
            </h2>
            <ul className="space-y-3">
              {category.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    {editing?.id === item.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          aria-label="Item name"
                        />
                        <Input
                          value={editing.price}
                          onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                          inputMode="decimal"
                          aria-label="Price"
                        />
                        <Input
                          value={editing.description}
                          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          placeholder="Description (optional)"
                          aria-label="Description"
                        />
                        <div className="flex gap-2">
                          <Button loading={saving} onClick={() => void saveEdit()}>
                            Save
                          </Button>
                          <Button variant="secondary" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-stone-900">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-stone-500">{item.description}</p>
                          )}
                          <p className="mt-1 font-bold text-brand-800">
                            {formatMoney(Number(item.price))}
                          </p>
                        </div>
                        <Pill tone={item.is_available ? "open" : "closed"}>
                          {item.is_available ? "Available" : "Sold out"}
                        </Pill>
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => startEdit(item)}>
                            Edit
                          </Button>
                          <Button
                            variant={item.is_available ? "danger" : "success"}
                            onClick={() => void toggleAvailability(item)}
                          >
                            {item.is_available ? "Mark sold out" : "Mark available"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </OperatorShell>
  );
}
