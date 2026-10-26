import { STATUS_META } from "../../lib/orderStatus";
import type { OrderStatus } from "../../types";

/**
 * Status is never conveyed by colour alone: every chip pairs a colour with a
 * glyph and the written status name.
 */
export function StatusChip({
  status,
  size = "md",
}: {
  status: OrderStatus;
  size?: "sm" | "md";
}) {
  const meta = STATUS_META[status];
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding} ${meta.chip}`}
      data-status={status}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export function StatusChipSolid({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${meta.solid}`}
      data-status={status}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
