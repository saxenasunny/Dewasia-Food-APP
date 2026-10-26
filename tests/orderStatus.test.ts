import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  ALLOWED_TRANSITIONS,
  ORDER_STATUSES,
  STATUS_META,
  TERMINAL_STATUSES,
  canTransition,
  isReasonRequired,
} from "../src/lib/orderStatus";

describe("order status state machine", () => {
  it("allows exactly the transitions documented in the blueprint", () => {
    expect(canTransition("PLACED", "ACCEPTED")).toBe(true);
    expect(canTransition("PLACED", "REJECTED")).toBe(true);
    expect(canTransition("PLACED", "CANCELLED")).toBe(true);
    expect(canTransition("ACCEPTED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("ACCEPTED", "CANCELLED")).toBe(true);
    expect(canTransition("IN_PROGRESS", "READY_TO_COLLECT")).toBe(true);
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransition("READY_TO_COLLECT", "COLLECTED")).toBe(true);
  });

  it("forbids skipping stages", () => {
    expect(canTransition("PLACED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("PLACED", "READY_TO_COLLECT")).toBe(false);
    expect(canTransition("PLACED", "COLLECTED")).toBe(false);
    expect(canTransition("ACCEPTED", "READY_TO_COLLECT")).toBe(false);
    expect(canTransition("ACCEPTED", "COLLECTED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "COLLECTED")).toBe(false);
  });

  it("never allows a terminal status to move again", () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const target of ORDER_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("never allows a status to change into itself", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("requires a reason for rejection and cancellation only", () => {
    expect(isReasonRequired("REJECTED")).toBe(true);
    expect(isReasonRequired("CANCELLED")).toBe(true);
    expect(isReasonRequired("ACCEPTED")).toBe(false);
    expect(isReasonRequired("IN_PROGRESS")).toBe(false);
    expect(isReasonRequired("READY_TO_COLLECT")).toBe(false);
    expect(isReasonRequired("COLLECTED")).toBe(false);
  });

  it("covers every status with metadata and terminal statuses have no exits", () => {
    for (const status of ORDER_STATUSES) {
      expect(STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(STATUS_META[status].customerMessage.length).toBeGreaterThan(0);
      expect(STATUS_META[status].icon.length).toBeGreaterThan(0);
    }
    expect(ALLOWED_TRANSITIONS.COLLECTED).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.REJECTED).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it("keeps active statuses limited to the four working queues", () => {
    expect([...ACTIVE_STATUSES]).toEqual(["PLACED", "ACCEPTED", "IN_PROGRESS", "READY_TO_COLLECT"]);
  });
});
