/**
 * Domain types. These mirror the Supabase schema in `supabase/migrations`.
 * Column names use snake_case (database convention); this file is the single
 * place where the app maps them to camelCase where it helps readability.
 */

export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "READY_TO_COLLECT"
  | "COLLECTED"
  | "REJECTED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID_AT_COUNTER" | "PAID" | "FAILED" | "REFUNDED";

export type UserRole = "student" | "guest" | "operator" | "admin";

export type TerminalStatus = "COLLECTED" | "REJECTED" | "CANCELLED";

export interface Profile {
  id: string;
  display_name: string | null;
  role: UserRole;
  college_identifier: string | null;
  created_at: string;
}

export interface Canteen {
  id: string;
  name: string;
  location_label: string;
  is_open: boolean;
  allow_customer_cancellation: boolean;
  estimated_wait_message: string;
  pickup_instructions: string;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  canteen_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  canteen_id: string;
  category_id: string;
  name: string;
  description: string | null;
  /** Rupees, 2 decimal places. Never trusted from the client at checkout. */
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

export interface Order {
  id: string;
  /** Human-readable pickup token, e.g. `A-1042`. Not an authorization secret. */
  order_number: string;
  user_id: string;
  canteen_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  total: number;
  customer_note: string | null;
  /** Present when the order is REJECTED or CANCELLED. */
  status_reason: string | null;
  tracking_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  created_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface NotificationLog {
  id: string;
  order_id: string;
  user_id: string;
  event_type: string;
  provider_status: string;
  attempted_at: string;
}

/** A cart line as held in local state before the server recalculates everything. */
export interface CartLine {
  menuItemId: string;
  name: string;
  /** Display only - the server re-prices every line at submission. */
  unitPrice: number;
  quantity: number;
}

export interface Cart {
  lines: CartLine[];
  note: string;
}
