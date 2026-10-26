import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Button, Card, Field } from "../components/ui/Primitives";
import { EmptyState } from "../components/ui/Feedback";
import { Stepper } from "../components/ui/Stepper";
import { useCart } from "../features/cart/CartProvider";
import { useCanteen } from "../hooks/useCanteen";
import { formatMoney } from "../lib/formatters";

export default function CartPage() {
  const { cart, setQuantity, removeLine, setNote, clear, subtotal } = useCart();
  const { canteen } = useCanteen();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  if (cart.lines.length === 0) {
    return (
      <CustomerShell title="Your cart" subtitle="Review your order">
        <EmptyState
          icon={"\u{1f6d2}"}
          title="Your cart is empty"
          description="Add something from the menu to get started."
          action={<Button onClick={() => navigate("/menu")}>Browse the menu</Button>}
        />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="Your cart" subtitle={`${cart.lines.length} item(s)`}>
      <div className="space-y-4">
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {cart.lines.map((line) => (
              <li key={line.menuItemId} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{line.name}</p>
                  <p className="text-sm text-stone-500">
                    {formatMoney(line.unitPrice)} each
                  </p>
                  <p className="mt-1 text-sm font-bold text-brand-800">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Stepper
                    quantity={line.quantity}
                    onChange={(next) => setQuantity(line.menuItemId, next)}
                    label={line.name}
                    min={0}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.menuItemId)}
                    className="text-xs font-semibold text-red-600 underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Field
          label="Note for the canteen (optional)"
          htmlFor="order-note"
          hint="Allergies, spice level, packing preference"
        >
          <textarea
            id="order-note"
            value={cart.note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Less spicy, no onion..."
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Card className="space-y-2">
          <div className="flex items-center justify-between text-sm text-stone-600">
            <span>Items</span>
            <span>{cart.lines.reduce((n, l) => n + l.quantity, 0)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold text-stone-900">
            <span>Total</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            {"\u{1f4b0}"} Payment is at the canteen counter. No online payment.
          </p>
        </Card>

        <div className="space-y-3">
          <Button block onClick={() => navigate("/checkout")}>
            Review &amp; place order
          </Button>
          <div className="flex items-center justify-between">
            <Link to="/menu" className="text-sm font-semibold text-brand-800 underline">
              Add more items
            </Link>
            {confirmClear ? (
              <span className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setConfirmClear(false);
                  }}
                  className="font-semibold text-red-600 underline"
                >
                  Confirm clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="font-semibold text-stone-500 underline"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-sm font-semibold text-stone-500 underline"
              >
                Clear cart
              </button>
            )}
          </div>
        </div>

        {canteen && !canteen.is_open && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            The canteen is closed, so ordering is paused.
          </p>
        )}
      </div>
    </CustomerShell>
  );
}
