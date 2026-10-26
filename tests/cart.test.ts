import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_CART,
  addLine,
  cartCount,
  cartSubtotal,
  clearCart,
  loadCart,
  reconcileCart,
  removeLine,
  saveCart,
  setQuantity,
} from "../src/lib/cart";

const samosa = { menuItemId: "a", name: "Samosa", unitPrice: 20, quantity: 1 };
const chai = { menuItemId: "b", name: "Chai", unitPrice: 15, quantity: 1 };

describe("cart", () => {
  it("adds a new line and merges repeats of the same item", () => {
    let cart = addLine(EMPTY_CART, samosa);
    cart = addLine(cart, samosa);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);
    expect(cartCount(cart)).toBe(2);
  });

  it("caps a single line at 50", () => {
    let cart = EMPTY_CART;
    cart = addLine(cart, { ...samosa, quantity: 40 });
    cart = addLine(cart, { ...samosa, quantity: 30 });
    expect(cart.lines[0].quantity).toBe(50);
  });

  it("computes a display subtotal", () => {
    let cart = addLine(EMPTY_CART, { ...samosa, quantity: 3 });
    cart = addLine(cart, { ...chai, quantity: 2 });
    expect(cartSubtotal(cart)).toBe(20 * 3 + 15 * 2);
  });

  it("removes a line when quantity drops to zero or below", () => {
    let cart = addLine(EMPTY_CART, samosa, 2);
    cart = setQuantity(cart, "a", 1);
    expect(cart.lines).toHaveLength(1);
    cart = setQuantity(cart, "a", 0);
    expect(cart.lines).toHaveLength(0);
    cart = setQuantity(cart, "a", -5);
    expect(cart.lines).toHaveLength(0);
  });

  it("removes by item id and clears", () => {
    let cart = addLine(addLine(EMPTY_CART, samosa), chai);
    cart = removeLine(cart, "a");
    expect(cart.lines.map((l) => l.menuItemId)).toEqual(["b"]);
    expect(clearCart()).toEqual(EMPTY_CART);
  });

  it("survives corrupt storage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockReturnValue("{not json");
    expect(loadCart()).toEqual(EMPTY_CART);
    spy.mockRestore();
  });

  it("round-trips through localStorage", () => {
    const cart = addLine(EMPTY_CART, samosa, 2);
    saveCart(cart);
    expect(loadCart()).toEqual(cart);
    localStorage.clear();
  });

  it("drops items that left the menu and refreshes prices", () => {
    const cart = addLine(addLine(EMPTY_CART, samosa, 2), chai);
    const next = reconcileCart(cart, [{ id: "a", name: "Samosa (new)", price: 25 }]);
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].name).toBe("Samosa (new)");
    expect(next.lines[0].unitPrice).toBe(25);
  });
});

beforeEach(() => {
  localStorage.clear();
});
