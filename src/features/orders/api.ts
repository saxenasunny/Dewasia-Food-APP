import { requireSupabase } from "../../lib/supabase";
import type { Order, OrderStatus, OrderWithItems } from "../../types";

const ORDER_WITH_ITEMS = `
  *,
  order_items (
    id,
    order_id,
    menu_item_id,
    item_name_snapshot,
    unit_price_snapshot,
    quantity,
    line_total
  )
`;

export interface CreateOrderInput {
  canteenId: string;
  lines: { menuItemId: string; quantity: number }[];
  customerNote: string;
  idempotencyKey: string;
}

/**
 * Order creation goes through the SECURITY DEFINER SQL function, which
 * re-prices every line, checks availability and de-duplicates retries.
 * The browser-supplied totals are never used.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_order", {
    p_canteen_id: input.canteenId,
    p_lines: input.lines.map((l) => ({
      menu_item_id: l.menuItemId,
      quantity: l.quantity,
    })),
    p_customer_note: input.customerNote,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw new Error(humanise(error.message));
  if (!data) throw new Error("The order could not be created.");
  return data as unknown as Order;
}

export async function transitionOrder(
  orderId: string,
  nextStatus: OrderStatus,
  reason?: string,
): Promise<Order> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: nextStatus,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(humanise(error.message));
  if (!data) throw new Error("The status could not be updated.");
  return data as unknown as Order;
}

export async function fetchOrder(orderId: string): Promise<OrderWithItems | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(humanise(error.message));
  return (data as OrderWithItems | null) ?? null;
}

export async function fetchMyOrders(limit = 50): Promise<OrderWithItems[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(humanise(error.message));
  return (data ?? []) as OrderWithItems[];
}

export async function fetchOperatorOrders(canteenId: string): Promise<OrderWithItems[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS)
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(humanise(error.message));
  return (data ?? []) as OrderWithItems[];
}

export async function fetchOrderHistory(orderId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });
  if (error) throw new Error(humanise(error.message));
  return data ?? [];
}

/** Turn raw Postgres error text into something a customer can act on. */
export function humanise(message: string): string {
  const text = message.replace(/^error:\s*/i, "");
  const patterns: [RegExp, string][] = [
    [/sold out/i, "An item in your cart just sold out."],
    [/no longer on the menu/i, "An item in your cart is no longer on the menu."],
    [/currently closed/i, "The canteen is closed right now."],
    [/cart is empty/i, "Your cart is empty."],
    [/idempotency key was already used/i, "This order was already submitted."],
    [/already being submitted/i, "Your order is already being submitted..."],
    [/reason is required/i, "Please give a reason before confirming."],
    [/Cannot move an order/i, "That status change is no longer allowed."],
    [/Illegal order status transition/i, "That status change is no longer allowed."],
    [/Only the canteen operator/i, "Only the canteen operator can do that."],
    [/Not signed in|Not authenticated|JWT expired/i, "Please sign in again."],
    [/Maximum quantity reached/i, "That is the maximum quantity for this item."],
    [/network|fetch/i, "We could not reach the server. Check your connection."],
  ];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(text)) return replacement;
  }
  return text.length > 180 ? "The request could not be completed." : text;
}
