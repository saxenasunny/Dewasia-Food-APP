import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatMoney,
  fromPaise,
  localDayKey,
  pluralize,
  toPaise,
} from "../src/lib/formatters";

describe("money helpers", () => {
  it("converts to and from integer paise without drift", () => {
    expect(toPaise(80)).toBe(8000);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(fromPaise(8000)).toBe(80);
  });

  it("formats INR with two decimals", () => {
    expect(formatMoney(80)).toMatch(/80\.00/);
    expect(formatMoney(45.5)).toMatch(/45\.50/);
  });
});

describe("formatAge", () => {
  const now = new Date("2026-10-25T12:00:00Z");

  it("describes order age", () => {
    expect(formatAge("2026-10-25T11:59:40Z", now)).toBe("just now");
    expect(formatAge("2026-10-25T11:57:00Z", now)).toBe("3 min ago");
    expect(formatAge("2026-10-25T09:00:00Z", now)).toBe("3 hr ago");
    expect(formatAge("2026-10-23T12:00:00Z", now)).toBe("2 d ago");
  });

  it("handles a malformed timestamp", () => {
    expect(formatAge("not-a-date", now)).toBe("-");
  });
});

describe("localDayKey", () => {
  it("produces a sortable YYYY-MM-DD key", () => {
    const key = localDayKey("2026-10-25T11:59:59Z");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDayKey("nope")).toBe("");
  });
});

describe("pluralize", () => {
  it("handles singular and plural", () => {
    expect(pluralize(1, "item")).toBe("item");
    expect(pluralize(2, "item")).toBe("items");
    expect(pluralize(0, "order", "orders")).toBe("orders");
  });
});
