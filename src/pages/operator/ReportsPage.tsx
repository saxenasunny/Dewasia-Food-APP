import { useEffect, useMemo, useState } from "react";
import { OperatorShell } from "../../components/layout/OperatorShell";
import { Button, Card, Input, Pill } from "../../components/ui/Primitives";
import { ErrorState, LoadingState } from "../../components/ui/Feedback";
import { useCanteen } from "../../hooks/useCanteen";
import { fetchOperatorOrders, humanise } from "../../features/orders/api";
import { formatMoney, localDayKey } from "../../lib/formatters";
import type { OrderWithItems } from "../../types";

export default function ReportsPage() {
  const { canteen } = useCanteen();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!canteen?.id) return;
    let cancelled = false;
    setLoading(true);
    fetchOperatorOrders(canteen.id)
      .then((rows) => {
        if (!cancelled) {
          setOrders(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? humanise(err.message) : "Failed to load report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canteen?.id, nonce]);

  const [day, setDay] = useState(() => localDayKey(new Date().toISOString()));

  const stats = useMemo(() => {
    const todays = orders.filter((o) => localDayKey(o.created_at) === day);
    const completed = todays.filter((o) => o.status !== "REJECTED" && o.status !== "CANCELLED");
    const gross = completed.reduce((sum, o) => sum + Number(o.total), 0);

    const itemCounts = new Map<string, { qty: number; value: number }>();
    for (const order of completed) {
      for (const item of order.order_items) {
        const entry = itemCounts.get(item.item_name_snapshot) ?? { qty: 0, value: 0 };
        entry.qty += item.quantity;
        entry.value += Number(item.line_total);
        itemCounts.set(item.item_name_snapshot, entry);
      }
    }

    const popular = [...itemCounts.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      count: todays.length,
      gross,
      rejected: todays.filter((o) => o.status === "REJECTED").length,
      cancelled: todays.filter((o) => o.status === "CANCELLED").length,
      collected: todays.filter((o) => o.status === "COLLECTED").length,
      active: todays.filter((o) =>
        ["PLACED", "ACCEPTED", "IN_PROGRESS", "READY_TO_COLLECT"].includes(o.status),
      ).length,
      popular,
    };
  }, [orders, day]);

  const todaysOrders = useMemo(
    () => orders.filter((o) => localDayKey(o.created_at) === day),
    [orders, day],
  );

  if (loading && orders.length === 0) {
    return (
      <OperatorShell title="Reports" subtitle="Loading">
        <LoadingState label="Building the report" />
      </OperatorShell>
    );
  }

  if (error) {
    return (
      <OperatorShell title="Reports">
        <ErrorState description={error} onRetry={() => setNonce((n) => n + 1)} />
      </OperatorShell>
    );
  }

  return (
    <OperatorShell
      title="Daily report"
      subtitle={canteen?.name ?? "Orders and sales"}
      right={
        <Button variant="secondary" onClick={() => setNonce((n) => n + 1)}>
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        <Card className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-stone-700">
            Report day
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <Button variant="secondary" onClick={() => setDay(localDayKey(new Date().toISOString()))}>
            Today
          </Button>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Orders" value={String(stats.count)} />
          <Stat label="Gross order value" value={formatMoney(stats.gross)} accent />
          <Stat label="Collected" value={String(stats.collected)} />
          <Stat label="Still active" value={String(stats.active)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Rejected" value={String(stats.rejected)} />
          <Stat label="Cancelled" value={String(stats.cancelled)} />
        </div>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Popular items
          </h2>
          {stats.popular.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No completed orders on this day yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {stats.popular.map((item, index) => (
                <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-stone-700">
                    <span className="mr-2 font-bold text-stone-900">#{index + 1}</span>
                    {item.name}
                  </span>
                  <span className="whitespace-nowrap font-semibold text-stone-900">
                    {item.qty} sold &middot; {formatMoney(item.value)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-0">
          <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-stone-500">
            Orders on this day
          </h2>
          {todaysOrders.length === 0 ? (
            <p className="px-4 py-4 text-sm text-stone-500">No orders recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {todaysOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-bold text-brand-800">{o.order_number}</span>
                  <Pill
                    tone={
                      o.status === "REJECTED" || o.status === "CANCELLED"
                        ? "closed"
                        : o.status === "COLLECTED"
                          ? "neutral"
                          : "open"
                    }
                  >
                    {o.status.replace(/_/g, " ")}
                  </Pill>
                  <span className="font-semibold text-stone-900">{formatMoney(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </OperatorShell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accent ? "text-brand-800" : "text-stone-900"}`}>
        {value}
      </p>
    </Card>
  );
}
