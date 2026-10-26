import { useEffect, useMemo, useRef, useState } from "react";
import { OperatorShell } from "../../components/layout/OperatorShell";
import { Button, Card, Pill } from "../../components/ui/Primitives";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { StatusChip } from "../../components/ui/StatusChip";
import { ReasonDialog } from "../../components/ui/ReasonDialog";
import { useCanteen } from "../../hooks/useCanteen";
import { useOrderUpdates } from "../../hooks/useOrderUpdates";
import { useAuth } from "../../features/auth/AuthProvider";
import { useToast } from "../../components/ui/Toast";
import { humanise, transitionOrder } from "../../features/orders/api";
import { requestPushSend } from "../../features/notifications/push";
import { STATUS_META } from "../../lib/orderStatus";
import { formatAge, formatMoney, formatTime } from "../../lib/formatters";
import type { OrderStatus, OrderWithItems } from "../../types";

type Tab = OrderStatus | "COMPLETED";

const TABS: { key: Tab; label: string }[] = [
  { key: "PLACED", label: "New" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "READY_TO_COLLECT", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
];

interface PendingAction {
  orderId: string;
  next: OrderStatus;
  orderNumber: string;
}

export default function OperatorDashboardPage() {
  const { canteen, loading: canteenLoading } = useCanteen();
  const { profile } = useAuth();
  const { notify } = useToast();

  const [tab, setTab] = useState<Tab>("PLACED");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const { orders, loading, error, connected, reload } = useOrderUpdates({
    scope: "operator",
    canteenId: canteen?.id,
    enabled: Boolean(canteen?.id),
  });

  // Clock for order age - refresh once a minute.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Beep for new orders, but only after the operator has interacted with the
  // page (browsers block autoplay otherwise).
  const seenRef = useRef<Set<string> | null>(null);
  const interactedRef = useRef(false);
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
    };
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  const newOrders = useMemo(
    () => orders.filter((o) => o.status === "PLACED").sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [orders],
  );

  useEffect(() => {
    if (!interactedRef.current) return;
    if (seenRef.current === null) {
      seenRef.current = new Set(newOrders.map((o) => o.id));
      return;
    }
    const fresh = newOrders.filter((o) => !seenRef.current!.has(o.id));
    if (fresh.length > 0) playChime();
    newOrders.forEach((o) => seenRef.current!.add(o.id));
  }, [newOrders]);

  const counts = useMemo(() => {
    const map: Record<Tab, number> = {
      PLACED: 0,
      ACCEPTED: 0,
      IN_PROGRESS: 0,
      READY_TO_COLLECT: 0,
      COMPLETED: 0,
      COLLECTED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const order of orders) {
      if (order.status === "COLLECTED" || order.status === "REJECTED" || order.status === "CANCELLED") {
        map.COMPLETED += 1;
      } else {
        map[order.status] += 1;
      }
    }
    return map;
  }, [orders]);

  const visible = useMemo(() => {
    const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (tab === "COMPLETED") {
      return sorted
        .filter((o) => ["COLLECTED", "REJECTED", "CANCELLED"].includes(o.status))
        .reverse()
        .slice(0, 50);
    }
    return sorted.filter((o) => o.status === tab);
  }, [orders, tab]);

  const runTransition = async (orderId: string, next: OrderStatus, reason?: string) => {
    setBusyOrder(orderId);
    try {
      const updated = await transitionOrder(orderId, next, reason);
      // Only move the card once the server has confirmed the change.
      notify(`${updated.order_number} -> ${STATUS_META[next].label}`, "success");
      await requestPushSend(orderId);
      reload();
    } catch (err) {
      notify(err instanceof Error ? humanise(err.message) : "Status update failed.", "error");
      reload();
    } finally {
      setBusyOrder(null);
      setPending(null);
    }
  };

  const title = canteen?.name ?? "Order board";

  if (canteenLoading || (loading && orders.length === 0)) {
    return (
      <OperatorShell title="Order board" subtitle="Loading">
        <LoadingState label="Loading orders" />
      </OperatorShell>
    );
  }

  if (error) {
    return (
      <OperatorShell title="Order board">
        <ErrorState description={error} onRetry={reload} />
      </OperatorShell>
    );
  }

  return (
    <OperatorShell
      title={title}
      subtitle={`${canteen?.location_label ?? ""} - signed in as ${profile?.display_name ?? "operator"}`}
      right={
        <span className="flex items-center gap-1.5 rounded-full bg-stone-700 px-3 py-1.5 text-xs font-semibold text-white">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
          />
          {connected ? "Live" : "Reconnecting"}
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone={canteen?.is_open ? "open" : "closed"}>
          <span aria-hidden="true">{canteen?.is_open ? "\u25cf" : "\u25a0"}</span>
          {canteen?.is_open ? "Canteen open" : "Canteen closed"}
        </Pill>
        {counts.PLACED > 0 && (
          <Pill>
            <span aria-hidden="true">{"\u26a0"}</span> {counts.PLACED} new waiting
          </Pill>
        )}
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                  className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ring-1 ${
                    active
                      ? "bg-stone-900 text-white ring-stone-900"
                      : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={"\u{1f3e1}"}
          title="Nothing here"
          description="No orders in this column right now."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderCard
                order={order}
                now={now}
                busy={busyOrder === order.id}
                onAccept={() => void runTransition(order.id, "ACCEPTED")}
                onProgress={() => void runTransition(order.id, "IN_PROGRESS")}
                onReady={() => void runTransition(order.id, "READY_TO_COLLECT")}
                onCollected={() => void runTransition(order.id, "COLLECTED")}
                onReject={() =>
                  setPending({ orderId: order.id, next: "REJECTED", orderNumber: order.order_number })
                }
                onCancel={() =>
                  setPending({ orderId: order.id, next: "CANCELLED", orderNumber: order.order_number })
                }
                onRenotify={() => void requestPushSend(order.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-stone-500">
        Queues are sorted oldest first, as recommended. Every change is written to the audit trail
        with your account and the time.
      </p>

      <ReasonDialog
        open={pending !== null}
        title={pending?.next === "REJECTED" ? `Reject ${pending.orderNumber}?` : `Cancel ${pending?.orderNumber}?`}
        description={
          pending?.next === "REJECTED"
            ? "The customer will be told the order could not be accepted, along with this reason."
            : "The customer will be told the order was cancelled, along with this reason."
        }
        confirmLabel={pending?.next === "REJECTED" ? "Reject order" : "Cancel order"}
        busy={busyOrder !== null}
        onConfirm={(reason) => {
          if (pending) void runTransition(pending.orderId, pending.next, reason);
        }}
        onCancel={() => setPending(null)}
      />
    </OperatorShell>
  );
}

interface OrderCardProps {
  order: OrderWithItems;
  now: Date;
  busy: boolean;
  onAccept: () => void;
  onProgress: () => void;
  onReady: () => void;
  onCollected: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRenotify: () => void;
}

function OrderCard({
  order,
  now,
  busy,
  onAccept,
  onProgress,
  onReady,
  onCollected,
  onReject,
  onCancel,
  onRenotify,
}: OrderCardProps) {
  const itemCount = order.order_items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black leading-none text-brand-800">{order.order_number}</p>
          <p className="mt-1 text-xs text-stone-500">
            {formatAge(order.created_at, now)} &middot; {formatTime(order.created_at)}
          </p>
        </div>
        <StatusChip status={order.status} size="sm" />
      </div>

      <ul className="space-y-1 border-t border-stone-100 pt-3 text-sm">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span className="text-stone-700">
              <span className="font-bold text-stone-900">{item.quantity}x</span>{" "}
              {item.item_name_snapshot}
            </span>
            <span className="text-stone-500">{formatMoney(Number(item.line_total))}</span>
          </li>
        ))}
      </ul>

      {order.customer_note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-bold">Note: </span>
          {order.customer_note}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
        <span className="text-sm font-semibold text-stone-500">
          Pay at counter &middot; {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        <span className="text-lg font-bold text-stone-900">
          {formatMoney(Number(order.total))}
        </span>
      </div>

      {order.status === "REJECTED" || order.status === "CANCELLED" ? (
        <p className="text-sm text-red-700">
          Reason: {order.status_reason || "not recorded"}
        </p>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2">
          {order.status === "PLACED" && (
            <>
              <Button loading={busy} onClick={onAccept} className="flex-1">
                Accept
              </Button>
              <Button variant="danger" disabled={busy} onClick={onReject}>
                Reject
              </Button>
            </>
          )}
          {order.status === "ACCEPTED" && (
            <>
              <Button loading={busy} onClick={onProgress} className="flex-1">
                Start Preparation
              </Button>
              <Button variant="danger" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
          {order.status === "IN_PROGRESS" && (
            <>
              <Button variant="success" loading={busy} onClick={onReady} className="flex-1">
                Mark Ready to Collect
              </Button>
              <Button variant="danger" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
          {order.status === "READY_TO_COLLECT" && (
            <>
              <Button variant="success" loading={busy} onClick={onCollected} className="flex-1">
                Mark Collected
              </Button>
              <Button variant="secondary" disabled={busy} onClick={onRenotify}>
                Re-notify
              </Button>
            </>
          )}
          {order.status === "COLLECTED" && (
            <span className="text-sm font-semibold text-stone-500">
              {"\u2705"} Handed over - no further action
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Short, quiet chime - only ever triggered after a real user gesture. */
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio is a nicety; never let it break the dashboard.
  }
}
