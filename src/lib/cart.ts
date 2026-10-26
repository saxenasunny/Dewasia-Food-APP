import type { Cart, CartLine } from "../types";

const STORAGE_KEY = "canteen-cart-v1";

export const EMPTY_CART: Cart = { lines: [], note: "" };

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Display-only subtotal. The server recalculates and is authoritative. */
export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function addLine(cart: Cart, line: CartLine, maxPerLine = 50): Cart {
  const existing = cart.lines.find((l) => l.menuItemId === line.menuItemId);
  if (!existing) {
    return { ...cart, lines: [...cart.lines, { ...line, quantity: Math.min(line.quantity, maxPerLine) }] };
  }
  return {
    ...cart,
    lines: cart.lines.map((l) =>
      l.menuItemId === line.menuItemId
        ? { ...l, quantity: Math.min(l.quantity + line.quantity, maxPerLine) }
        : l,
    ),
  };
}

export function setQuantity(cart: Cart, menuItemId: string, quantity: number): Cart {
  if (quantity <= 0) {
    return { ...cart, lines: cart.lines.filter((l) => l.menuItemId !== menuItemId) };
  }
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l)),
  };
}

export function removeLine(cart: Cart, menuItemId: string): Cart {
  return { ...cart, lines: cart.lines.filter((l) => l.menuItemId !== menuItemId) };
}

export function clearCart(): Cart {
  return EMPTY_CART;
}

export function loadCart(): Cart {
  if (typeof localStorage === "undefined") return EMPTY_CART;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as Cart;
    if (!parsed || !Array.isArray(parsed.lines)) return EMPTY_CART;
    return { lines: parsed.lines, note: typeof parsed.note === "string" ? parsed.note : "" };
  } catch {
    return EMPTY_CART;
  }
}

export function saveCart(cart: Cart): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage may be unavailable (private mode); cart stays in memory.
  }
}

/** Drop lines whose item disappeared or became unavailable. */
export function reconcileCart(
  cart: Cart,
  available: { id: string; name: string; price: number }[],
): Cart {
  const byId = new Map(available.map((i) => [i.id, i]));
  const lines = cart.lines
    .filter((line) => byId.has(line.menuItemId))
    .map((line) => {
      const item = byId.get(line.menuItemId)!;
      return { ...line, name: item.name, unitPrice: item.price };
    });
  return { ...cart, lines };
}
