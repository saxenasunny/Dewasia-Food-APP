import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  fetchMyOrders,
  fetchOperatorOrders,
} from "../features/orders/api";
import type { OrderWithItems } from "../types";

type Scope = "customer" | "operator";

interface UseOrderUpdatesOptions {
  scope: Scope;
  canteenId: string | undefined;
  enabled: boolean;
}

interface UseOrderUpdatesResult {
  orders: OrderWithItems[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  reload: () => void;
}

/**
 * Realtime is only a hint that data changed: every event triggers a full
 * refetch so the view always reflects authoritative database state, and a
 * reconnect refetches too.
 */
export function useOrderUpdates({
  scope,
  canteenId,
  enabled,
}: UseOrderUpdatesOptions): UseOrderUpdatesResult {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadingRef = useRef(enabled);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!supabase || (scope === "operator" && !canteenId)) {
      setLoading(false);
      return;
    }

    const client = supabase!;
    let cancelled = false;

    const load = async () => {
      try {
        const rows =
          scope === "operator"
            ? await fetchOperatorOrders(canteenId as string)
            : await fetchMyOrders();
        if (cancelled) return;
        setOrders(rows);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        if (!cancelled) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    };

    loadingRef.current = true;
    setLoading(true);
    void load();

    const channel = client
      .channel(`orders-${scope}-${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (!cancelled) void load();
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        const isUp = status === "SUBSCRIBED";
        setConnected(isUp);
        if (isUp) void load(); // refetch on every reconnect
      });

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [scope, canteenId, enabled, nonce]);

  return { orders, loading, error, connected, reload };
}
