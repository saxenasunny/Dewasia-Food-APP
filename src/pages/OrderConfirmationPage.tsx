import { Link, Navigate, useParams } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Card } from "../components/ui/Primitives";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { useOrder } from "../hooks/useOrder";
import { useCanteen } from "../hooks/useCanteen";
import { formatDateTime, formatMoney } from "../lib/formatters";

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { order, loading, error, reload } = useOrder(id);
  const { canteen } = useCanteen();

  if (!id) return <Navigate to="/orders" replace />;

  return (
    <CustomerShell title="Order placed" subtitle="Keep this token handy" hideNav>
      {loading ? (
        <LoadingState label="Loading your order" />
      ) : error || !order ? (
        <ErrorState description={error ?? "Order not found."} onRetry={reload} />
      ) : (
        <div className="space-y-4">
          <Card className="text-center">
            <div className="text-sm font-semibold text-emerald-700">{"\u2705"} Order confirmed</div>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-stone-500">
              Pickup token
            </p>
            <p className="mt-1 text-5xl font-black tracking-tight text-brand-800">
              {order.order_number}
            </p>
            <p className="mt-3 text-sm text-stone-600">{formatDateTime(order.created_at)}</p>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {"\u{1f4b0}"} Pay {formatMoney(Number(order.total))} at the canteen counter.
            </p>
          </Card>

          <Card className="p-0">
            <ul className="divide-y divide-stone-100">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-stone-900">{item.item_name_snapshot}</span>
                    <span className="ml-2 text-sm text-stone-500">x{item.quantity}</span>
                  </span>
                  <span className="font-semibold text-stone-800">
                    {formatMoney(Number(item.line_total))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-3 font-bold text-stone-900">
              <span>Total</span>
              <span>{formatMoney(Number(order.total))}</span>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Pickup</p>
            <p className="mt-1 text-sm text-stone-700">
              {canteen?.pickup_instructions ?? "Collect from the canteen counter."}
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Expected wait: <strong>{canteen?.estimated_wait_message ?? "-"}</strong>
            </p>
          </Card>

          <div className="space-y-3">
            <Link
              to={`/orders/${order.id}`}
              className="block w-full rounded-xl bg-brand-700 px-5 py-3 text-center text-base font-semibold text-white hover:bg-brand-800"
            >
              Track my order
            </Link>
            <Link
              to="/menu"
              className="block w-full rounded-xl px-5 py-3 text-center text-base font-semibold text-brand-800 underline"
            >
              Order something else
            </Link>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}
