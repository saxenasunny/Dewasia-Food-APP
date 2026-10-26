import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Button, Card } from "../components/ui/Primitives";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { StatusChipSolid } from "../components/ui/StatusChip";
import { useOrder } from "../hooks/useOrder";
import { useCanteen } from "../hooks/useCanteen";
import { useAuth } from "../features/auth/AuthProvider";
import { useToast } from "../components/ui/Toast";
import { STATUS_META } from "../lib/orderStatus";
import { transitionOrder, humanise } from "../features/orders/api";
import { enablePush, isPushSupported, pushPermission } from "../features/notifications/push";
import { formatDateTime, formatMoney, formatTime } from "../lib/formatters";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import type { OrderStatus } from "../types";

const TIMELINE: OrderStatus[] = ["PLACED", "ACCEPTED", "IN_PROGRESS", "READY_TO_COLLECT", "COLLECTED"];

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const { order, history, loading, error, connected, reload } = useOrder(id);
  const { canteen } = useCanteen();
  const { session } = useAuth();
  const { notify } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  if (!id) return <Navigate to="/orders" replace />;

  const canCancel =
    order &&
    order.status === "PLACED" &&
    order.user_id === session?.user.id &&
    (canteen?.allow_customer_cancellation ?? false);

  const confirmCancel = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await transitionOrder(order.id, "CANCELLED", "Cancelled by the customer.");
      notify("Order cancelled.", "success");
      reload();
    } catch (err) {
      notify(err instanceof Error ? humanise(err.message) : "Could not cancel the order.", "error");
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  };

  const optInPush = async () => {
    setPushBusy(true);
    const result = await enablePush();
    notify(result.message, result.ok ? "success" : "error");
    setPushBusy(false);
  };

  const activeIndex = order ? TIMELINE.indexOf(order.status) : -1;
  const isRejectedLike = order && (order.status === "REJECTED" || order.status === "CANCELLED");

  return (
    <CustomerShell
      title={order ? `Order ${order.order_number}` : "Track order"}
      subtitle={order ? formatDateTime(order.created_at) : undefined}
      right={
        <span className="flex items-center gap-1.5 rounded-full bg-brand-900/40 px-3 py-1.5 text-xs font-semibold">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`}
          />
          {connected ? "Live" : "Reconnecting"}
        </span>
      }
    >
      {loading ? (
        <LoadingState label="Loading your order" />
      ) : error || !order ? (
        <ErrorState description={error ?? "Order not found."} onRetry={reload} />
      ) : (
        <div className="space-y-4">
          <Card className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Pickup token</p>
            <p className="text-4xl font-black text-brand-800">{order.order_number}</p>
            <div className="mt-3 flex justify-center">
              <StatusChipSolid status={order.status} />
            </div>
            <p className="mt-3 text-sm text-stone-700">{STATUS_META[order.status].customerMessage}</p>
            {order.status_reason && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                Reason: {order.status_reason}
              </p>
            )}
          </Card>

          {isRejectedLike ? null : (
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                Progress
              </p>
              <ol className="space-y-0">
                {TIMELINE.map((step, index) => {
                  const done = activeIndex >= index && activeIndex !== -1;
                  const current = activeIndex === index;
                  const isLast = index === TIMELINE.length - 1;
                  return (
                    <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[11px] top-6 h-full w-0.5 ${
                            done ? "bg-brand-500" : "bg-stone-200"
                          }`}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          current
                            ? "bg-brand-700 text-white ring-4 ring-brand-100"
                            : done
                              ? "bg-brand-500 text-white"
                              : "bg-stone-200 text-stone-500"
                        }`}
                      >
                        {done ? "\u2713" : index + 1}
                      </span>
                      <span className={`pt-0.5 text-sm ${current ? "font-bold text-stone-900" : "text-stone-600"}`}>
                        {STATUS_META[step].label}
                        {current && <span className="ml-2 text-xs font-semibold text-brand-700">Now</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

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
            <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-3">
              <span className="font-bold text-stone-900">Total</span>
              <span className="font-bold text-stone-900">{formatMoney(Number(order.total))}</span>
            </div>
            <p className="border-t border-stone-200 px-4 py-2 text-center text-xs font-semibold text-amber-800">
              {"\u{1f4b0}"} Payment due at the counter
            </p>
          </Card>

          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Updates</p>
            {history.length > 0 ? (
              <ol className="mt-2 space-y-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-stone-700">
                      {STATUS_META[entry.new_status as OrderStatus]?.label ?? entry.new_status}
                      {entry.reason && <span className="block text-xs text-stone-500">{entry.reason}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-stone-400">{formatTime(entry.changed_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-stone-500">No changes yet.</p>
            )}
          </Card>

          <PushCard
            supported={isPushSupported()}
            permission={pushPermission()}
            busy={pushBusy}
            onEnable={() => void optInPush()}
          />

          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Pickup</p>
            <p className="mt-1 text-sm text-stone-700">
              {canteen?.pickup_instructions ?? "Collect from the canteen counter."}
            </p>
          </Card>

          {canCancel && (
            <div className="space-y-3">
              <Button block variant="danger" onClick={() => setCancelling(true)} loading={busy}>
                Cancel this order
              </Button>
              <p className="text-center text-xs text-stone-500">
                Cancellation is only possible before the canteen accepts your order.
              </p>
            </div>
          )}

          <Link
            to="/orders"
            className="block w-full rounded-xl px-5 py-3 text-center text-sm font-semibold text-brand-800 underline"
          >
            Back to my orders
          </Link>

          <ConfirmDialog
            open={cancelling}
            title="Cancel this order?"
            description={`Order ${order.order_number} will be cancelled and the canteen will be told.`}
            confirmLabel="Yes, cancel it"
            busy={busy}
            onConfirm={() => void confirmCancel()}
            onCancel={() => setCancelling(false)}
          />
        </div>
      )}
    </CustomerShell>
  );
}

function PushCard({
  supported,
  permission,
  busy,
  onEnable,
}: {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  busy: boolean;
  onEnable: () => void;
}) {
  if (!supported) {
    return (
      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Notifications</p>
        <p className="mt-1 text-sm text-stone-500">
          This browser does not support push notifications - keep this page open for live updates.
        </p>
      </Card>
    );
  }

  if (permission === "granted") {
    return (
      <Card className="flex items-center gap-2">
        <span aria-hidden="true">{"\u23f0"}</span>
        <p className="text-sm text-stone-700">
          Notifications are on. We will tell you when your food is ready.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Notifications</p>
      <p className="mt-1 text-sm text-stone-600">
        Get a heads-up when your order is ready to collect. We only send order updates.
      </p>
      <div className="mt-3">
        <Button loading={busy} onClick={onEnable} className="!min-h-10 px-4 py-2 text-sm">
          {permission === "denied" ? "Try enabling again" : "Notify me when it is ready"}
        </Button>
      </div>
      {permission === "denied" && (
        <p className="mt-2 text-xs text-stone-500">
          Notifications are blocked in your browser settings; live updates still work on this
          page.
        </p>
      )}
    </Card>
  );
}
