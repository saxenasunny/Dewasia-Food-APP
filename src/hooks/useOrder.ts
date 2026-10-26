import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchOrder, fetchOrderHistory } from "../features/orders/api";
import type { OrderWithItems } from "../types";

export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [history, setHistory] = useState<
    { id: string; old_status: string | null; new_status: string; changed_at: string; reason: string | null }[]
  >([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!orderId || !supabase) {
      setLoading(false);
      return;
    }
    const client = supabase!;
    let cancelled = false;

    const load = async () => {
      try {
        const [row, trail] = await Promise.all([fetchOrder(orderId), fetchOrderHistory(orderId)]);
        if (cancelled) return;
        setOrder(row);
        setHistory(trail);
        setError(row ? null : "Order not found.");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void load();

    const channel = client
      .channel(`order-${orderId}-${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => {
          if (!cancelled) void load();
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        const up = status === "SUBSCRIBED";
        setConnected(up);
        if (up) void load(); // reconnect => authoritative refetch
      });

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [orderId, nonce]);

  return { order, history, loading, error, connected, reload };
}
