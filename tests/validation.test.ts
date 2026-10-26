import { describe, expect, it } from "vitest";
import {
  clampNote,
  isValidEmail,
  isValidPrice,
  isValidQuantity,
  makeIdempotencyKey,
  validateOrderPayload,
} from "../src/lib/validation";

const validPayload = {
  canteenId: "11111111-1111-4111-8111-111111111111",
  lines: [{ menuItemId: "33333333-3333-4333-8333-333333333301", quantity: 2 }],
  customerNote: "less spicy",
  idempotencyKey: "6f1f0f0a-1a1a-4a1a-8a1a-1a1a1a1a1a1a",
};

describe("validateOrderPayload", () => {
  it("accepts a well-formed payload", () => {
    const result = validateOrderPayload(validPayload);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty cart", () => {
    const result = validateOrderPayload({ ...validPayload, lines: [] });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Your cart is empty.");
  });

  it("rejects quantities outside the allowed range", () => {
    for (const quantity of [0, -1, 1.5, 51]) {
      const result = validateOrderPayload({
        ...validPayload,
        lines: [{ menuItemId: "x", quantity }],
      });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects duplicate lines for the same item", () => {
    const result = validateOrderPayload({
      ...validPayload,
      lines: [
        { menuItemId: "same", quantity: 1 },
        { menuItemId: "same", quantity: 2 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Duplicate item in cart.");
  });

  it("rejects an over-long note", () => {
    const result = validateOrderPayload({ ...validPayload, customerNote: "n".repeat(301) });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed idempotency key", () => {
    const result = validateOrderPayload({ ...validPayload, idempotencyKey: "short" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing canteen", () => {
    const result = validateOrderPayload({ ...validPayload, canteenId: "" });
    expect(result.ok).toBe(false);
  });
});

describe("field validators", () => {
  it("validates quantities", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(50)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(2.5)).toBe(false);
    expect(isValidQuantity(Number.NaN)).toBe(false);
  });

  it("validates prices", () => {
    expect(isValidPrice(0)).toBe(true);
    expect(isValidPrice(80.5)).toBe(true);
    expect(isValidPrice(-1)).toBe(false);
    expect(isValidPrice(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("validates emails", () => {
    expect(isValidEmail("operator@college.edu")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("clamps notes to 300 characters", () => {
    expect(clampNote("n".repeat(400))).toHaveLength(300);
  });

  it("produces unique idempotency keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => makeIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key.length).toBeGreaterThanOrEqual(16);
    }
  });
});
