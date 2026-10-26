import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Button, Card, Input, Pill } from "../components/ui/Primitives";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/Feedback";
import { Stepper } from "../components/ui/Stepper";
import { useCanteen } from "../hooks/useCanteen";
import { useMenu } from "../hooks/useMenu";
import { useCart } from "../features/cart/CartProvider";
import { useToast } from "../components/ui/Toast";
import { formatMoney } from "../lib/formatters";
import type { MenuItem } from "../types";

export default function MenuPage() {
  const { canteen } = useCanteen();
  const { categories, loading, error, reload } = useMenu(canteen?.id);
  const { cart, addLine, setQuantity } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const quantityFor = (id: string) => cart.lines.find((l) => l.menuItemId === id)?.quantity ?? 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            !q ||
            item.name.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((category) => !activeCategory || category.id === activeCategory)
      .filter((category) => category.items.length > 0);
  }, [categories, query, activeCategory]);

  const handleAdd = (item: MenuItem) => {
    if (!canteen?.is_open) {
      notify("The canteen is closed right now.", "error");
      return;
    }
    addLine({ menuItemId: item.id, name: item.name, unitPrice: Number(item.price) });
    notify(`${item.name} added to your cart.`, "success");
  };

  return (
    <CustomerShell title={canteen?.name ?? "Menu"} subtitle={canteen?.location_label}>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Pill tone={canteen?.is_open ? "open" : "closed"}>
            <span aria-hidden="true">{canteen?.is_open ? "\u25cf" : "\u25a0"}</span>
            {canteen?.is_open ? "Open" : "Closed"}
          </Pill>
          {canteen && <span className="text-xs text-stone-500">{canteen.estimated_wait_message}</span>}
        </div>

        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes..."
          aria-label="Search the menu"
        />
      </div>

      {canteen && !canteen.is_open && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The canteen is closed. You can still browse the menu - ordering reopens when it opens.
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading the menu" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No dishes found"
          description={query ? `Nothing matches "${query}".` : "The menu has no items yet."}
          action={
            query ? (
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <nav aria-label="Categories" className="mb-4 -mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2 pb-1">
              <li>
                <CategoryTab
                  active={activeCategory === null}
                  onClick={() => setActiveCategory(null)}
                  label="All"
                />
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <CategoryTab
                    active={activeCategory === category.id}
                    onClick={() => setActiveCategory(category.id)}
                    label={category.name}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {filtered.map((category) => (
              <section key={category.id} aria-labelledby={`cat-${category.id}`}>
                <h2
                  id={`cat-${category.id}`}
                  className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500"
                >
                  {category.name}
                </h2>
                <ul className="space-y-3">
                  {category.items.map((item) => {
                    const qty = quantityFor(item.id);
                    return (
                      <li key={item.id}>
                        <Card className="flex gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt=""
                              className="h-20 w-20 shrink-0 rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-3xl"
                            >
                              {"\u{1f35e}"}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-stone-900">{item.name}</h3>
                              <span className="whitespace-nowrap font-bold text-brand-800">
                                {formatMoney(Number(item.price))}
                              </span>
                            </div>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">
                                {item.description}
                              </p>
                            )}

                            <div className="mt-2 flex items-center justify-between gap-2">
                              {!item.is_available ? (
                                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700">
                                  Sold out
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-700">
                                  Available
                                </span>
                              )}

                              {!item.is_available ? (
                                <Button variant="secondary" disabled>
                                  Unavailable
                                </Button>
                              ) : qty === 0 ? (
                                <Button onClick={() => handleAdd(item)} className="!min-h-9 px-4 py-2 text-sm">
                                  Add
                                </Button>
                              ) : (
                                <Stepper
                                  quantity={qty}
                                  onChange={(next) => setQuantity(item.id, next)}
                                  label={item.name}
                                />
                              )}
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <Button block variant="secondary" onClick={() => navigate("/cart")}>
          Review cart
        </Button>
      </div>
    </CustomerShell>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
        active
          ? "bg-brand-700 text-white ring-brand-700"
          : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}
