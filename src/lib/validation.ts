/** Pure validation helpers used by forms. Server-side checks are authoritative. */

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 50;
}

export function isValidPrice(price: number): boolean {
  return Number.isFinite(price) && price >= 0 && price <= 100000;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function clampNote(note: string): string {
  return note.slice(0, 300);
}

export interface OrderPayloadLine {
  menuItemId: string;
  quantity: number;
}

export interface OrderPayload {
  canteenId: string;
  lines: OrderPayloadLine[];
  customerNote: string;
  idempotencyKey: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

export function validateOrderPayload(payload: OrderPayload): ValidationResult<OrderPayload> {
  const errors: string[] = [];

  if (!payload.canteenId) errors.push("Missing canteen.");
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    errors.push("Your cart is empty.");
  } else {
    const seen = new Set<string>();
    for (const line of payload.lines) {
      if (!line.menuItemId) errors.push("A cart line is missing its item.");
      if (!isValidQuantity(line.quantity)) errors.push("Invalid quantity in cart.");
      if (seen.has(line.menuItemId)) errors.push("Duplicate item in cart.");
      seen.add(line.menuItemId);
    }
  }

  if (payload.customerNote.length > 300) errors.push("Order note is too long.");
  if (!/^[0-9a-f-]{16,64}$/i.test(payload.idempotencyKey)) {
    errors.push("Invalid idempotency key.");
  }

  return errors.length === 0 ? { ok: true, errors: [], value: payload } : { ok: false, errors };
}

export function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
