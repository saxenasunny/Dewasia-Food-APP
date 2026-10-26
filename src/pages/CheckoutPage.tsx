import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Button, Card } from "../components/ui/Primitives";
import { EmptyState } from "../components/ui/Feedback";
import { useCart } from "../features/cart/CartProvider";
import { useCanteen } from "../hooks/useCanteen";
import { useToast } from "../components/ui/Toast";
import { createOrder, humanise } from "../features/orders/api";
import { formatMoney } from "../lib/formatters";
import { makeIdempotencyKey, validateOrderPayload } from "../lib/validation";
import { PRIMARY_CANTEEN_ID } from "../hooks/useCanteen";

export default function CheckoutPage() {
  const { cart, clear, subtotal } = useCart();
  const { canteen } = useCanteen();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // One key per checkout screen: a double tap or a network retry reuses it and
  // the database returns the original order instead of creating a second one.
  const idempotencyKey = useMemo(() => makeIdempotencyKey(), []);
  const submittedRef = useRef(false);

  const canteenId = canteen?.id ?? PRIMARY_CANTEEN_ID;

  if (cart.lines.length === 0) {
    return (
      <CustomerShell title="Checkout" hideNav>
        <EmptyState
          icon={"\u{1f6d2}"}
          title="Nothing to check out"
          description="Your cart is empty."
          action={<Button onClick={() => navigate("/menu")}>Back to the menu</Button>}
        />
      </CustomerShell>
    );
  }

  const placeOrder = async () => {
    if (submittedRef.current) return; // guard against a double tap
    setErrors([]);

    const payload = {
      canteenId,
      lines: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      customerNote: cart.note,
      idempotencyKey,
    };

    const check = validateOrderPayload(payload);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    try {
      const order = await createOrder(payload);
      clear();
      notify(`Order ${order.order_number} placed.`, "success");
      navigate(`/orders/${order.id}/confirmation`, { replace: true });
    } catch (err) {
      submittedRef.current = false;
      const message = err instanceof Error ? humanise(err.message) : "The order could not be placed.";
      setErrors([message]);
      notify(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerShell title="Checkout" subtitle="Confirm your order" hideNav>
      <div className="space-y-4">
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {cart.lines.map((line) => (
              <li key={line.menuItemId} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-stone-900">{line.name}</span>
                  <span className="ml-2 text-sm text-stone-500">x{line.quantity}</span>
                </span>
                <span className="font-semibold text-stone-800">
                  {formatMoney(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {cart.note.trim() && (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Your note</p>
            <p className="mt-1 text-sm text-stone-700">{cart.note}</p>
          </Card>
        )}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold text-stone-900">
            <span>Pay at counter</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            No online payment in this release. Pay when you collect.
          </p>
        </Card>

        {canteen && (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Pickup</p>
            <p className="mt-1 text-sm text-stone-700">{canteen.pickup_instructions}</p>
            <p className="mt-2 text-sm text-stone-600">
              Expected wait: <strong>{canteen.estimated_wait_message}</strong>
            </p>
          </Card>
        )}

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <ul className="list-inside list-disc space-y-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {canteen && !canteen.is_open && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            The canteen is closed, so ordering is paused.
          </p>
        )}

        <Button
          block
          loading={submitting}
          disabled={Boolean(canteen && !canteen.is_open)}
          onClick={() => void placeOrder()}
        >
          {submitting ? "Placing order..." : "Place order"}
        </Button>
        <button
          type="button"
          onClick={() => navigate("/cart")}
          className="w-full text-center text-sm font-semibold text-brand-800 underline"
        >
          Back to cart
        </button>
      </div>
    </CustomerShell>
  );
}
