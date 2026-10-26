import type { OrderStatus } from "../types";

/**
 * Allowed state transitions, exactly as specified in the blueprint:
 *
 *   PLACED          -> ACCEPTED | REJECTED | CANCELLED (policy permitting)
 *   ACCEPTED        -> IN_PROGRESS | CANCELLED (operator, reason required)
 *   IN_PROGRESS     -> READY_TO_COLLECT | CANCELLED (operator, reason required)
 *   READY_TO_COLLECT-> COLLECTED
 *
 * Terminal statuses have no further normal transitions.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY_TO_COLLECT", "CANCELLED"],
  READY_TO_COLLECT: ["COLLECTED"],
  COLLECTED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "IN_PROGRESS",
  "READY_TO_COLLECT",
  "COLLECTED",
  "REJECTED",
  "CANCELLED",
];

export const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "IN_PROGRESS",
  "READY_TO_COLLECT",
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["COLLECTED", "REJECTED", "CANCELLED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Rejection and cancellation always require a reason. */
export function isReasonRequired(to: OrderStatus): boolean {
  return to === "REJECTED" || to === "CANCELLED";
}

/** The operator advances preparation, marks ready and marks collected. */
export const OPERATOR_ADVANCES: readonly OrderStatus[] = [
  "ACCEPTED",
  "IN_PROGRESS",
  "READY_TO_COLLECT",
  "COLLECTED",
];

export interface StatusMeta {
  label: string;
  customerMessage: string;
  /** Tailwind classes for a light background chip. */
  chip: string;
  /** Tailwind classes for a solid badge. */
  solid: string;
  /** Single glyph so status never depends on colour alone. */
  icon: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PLACED: {
    label: "Placed",
    customerMessage: "Order received; waiting for canteen confirmation.",
    chip: "bg-amber-100 text-amber-900",
    solid: "bg-amber-500 text-white",
    icon: "\u23f3",
  },
  ACCEPTED: {
    label: "Accepted",
    customerMessage: "Your order has been accepted.",
    chip: "bg-sky-100 text-sky-900",
    solid: "bg-sky-500 text-white",
    icon: "\u2714",
  },
  IN_PROGRESS: {
    label: "In Progress",
    customerMessage: "Your food is being prepared.",
    chip: "bg-indigo-100 text-indigo-900",
    solid: "bg-indigo-500 text-white",
    icon: "\U0001f373",
  },
  READY_TO_COLLECT: {
    label: "Ready to Collect",
    customerMessage: "Your order is ready. Please collect it.",
    chip: "bg-emerald-100 text-emerald-900",
    solid: "bg-emerald-600 text-white",
    icon: "\u2611",
  },
  COLLECTED: {
    label: "Collected",
    customerMessage: "Order completed. Thank you.",
    chip: "bg-stone-200 text-stone-800",
    solid: "bg-stone-600 text-white",
    icon: "\u2705",
  },
  REJECTED: {
    label: "Rejected",
    customerMessage: "Order could not be accepted; see reason.",
    chip: "bg-red-100 text-red-900",
    solid: "bg-red-600 text-white",
    icon: "\u274c",
  },
  CANCELLED: {
    label: "Cancelled",
    customerMessage: "Order cancelled.",
    chip: "bg-stone-100 text-stone-700",
    solid: "bg-stone-500 text-white",
    icon: "\u21a9",
  },
};

/** Queue columns on the operator board, in processing order. */
export const BOARD_COLUMNS: readonly OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "IN_PROGRESS",
  "READY_TO_COLLECT",
];

/** Push notification copy from the blueprint's notification table. */
export const PUSH_COPY: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  ACCEPTED: { title: "Order accepted", body: "The canteen has accepted your order." },
  IN_PROGRESS: { title: "Preparing your order", body: "Your order is being prepared." },
  READY_TO_COLLECT: {
    title: "Your order is ready!",
    body: "Please collect it from the canteen counter.",
  },
  REJECTED: { title: "Order update", body: "Your order could not be accepted. Open the app for details." },
  CANCELLED: { title: "Order cancelled", body: "Your order has been cancelled." },
};
