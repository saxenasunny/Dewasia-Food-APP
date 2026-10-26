import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/Feedback";
import { StatusChip } from "../components/ui/StatusChip";
import { fetchMyOrders, humanise } from "../features/orders/api";
import { useAuth } from "../features/auth/AuthProvider";
import { formatDate, formatMoney, formatTime } from "../lib/formatters";
import type { OrderWithItems } from "../types";

export default function OrderHistoryPage() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchMyOrders()
      .then((rows) => {
        if (!cancelled) {
          setOrders(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? humanise(err.message) : "Failed to load orders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <CustomerShell title="My orders" subtitle="Past and current orders">
      {loading ? (
        <LoadingState label="Loading your orders" />
      ) : error ? (
        <ErrorState description={error} onRetry={() => window.location.reload()} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Orders you place will show up here with their live status."
          action={<Link to="/menu" className="inline-block rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white">Browse the menu</Link>}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="block rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-brand-800">{order.order_number}</span>
                  <StatusChip status={order.status} size="sm" />
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {order.order_items.reduce((n, i) => n + i.quantity, 0)} item(s) &middot;{" "}
                  {formatMoney(Number(order.total))}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {formatDate(order.created_at)} at {formatTime(order.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CustomerShell>
  );
}
