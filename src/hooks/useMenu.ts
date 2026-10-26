import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { MenuCategory, MenuItem } from "../types";

export interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

interface UseMenuResult {
  categories: CategoryWithItems[];
  items: MenuItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMenu(canteenId: string | undefined): UseMenuResult {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!supabase || !canteenId) {
      setLoading(false);
      return;
    }
    const client = supabase!;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [catRes, itemRes] = await Promise.all([
        client
          .from("menu_categories")
          .select("*")
          .eq("canteen_id", canteenId)
          .order("sort_order"),
        client
          .from("menu_items")
          .select("*")
          .eq("canteen_id", canteenId)
          .order("sort_order"),
      ]);
      if (cancelled) return;
      if (catRes.error || itemRes.error) {
        setError(catRes.error?.message ?? itemRes.error?.message ?? "Failed to load the menu");
      } else {
        setError(null);
        setCategories((catRes.data ?? []) as MenuCategory[]);
        setItems((itemRes.data ?? []) as MenuItem[]);
      }
      setLoading(false);
    };

    void load();

    // Availability and prices can change while the customer is browsing.
    const channel = client
      .channel(`menu-${canteenId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          if (!cancelled) void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [canteenId, nonce]);

  const categoriesWithItems = useMemo<CategoryWithItems[]>(
    () =>
      categories.map((category) => ({
        ...category,
        items: items.filter((item) => item.category_id === category.id),
      })),
    [categories, items],
  );

  return { categories: categoriesWithItems, items, loading, error, reload };
}
