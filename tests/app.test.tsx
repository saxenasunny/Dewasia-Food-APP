import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";
import { StatusChip } from "../src/components/ui/StatusChip";

// The unconfigured-credentials screen must be testable whether or not a local
// .env exists, so the Supabase client is stubbed out for this module.
vi.mock("../src/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/supabase")>();
  return { ...actual, isSupabaseConfigured: false, supabase: null, VAPID_PUBLIC_KEY: "" };
});

const goTo = (path: string) => window.history.pushState({}, "", path);

describe("App", () => {
  it("shows setup instructions when Supabase is not configured", () => {
    goTo("/");
    render(<App />);
    expect(screen.getByText("Connect your Supabase project")).toBeInTheDocument();
    expect(screen.queryByText("Continue as Guest")).not.toBeInTheDocument();
  });

  it("sends unknown routes to the 404 page", () => {
    goTo("/does-not-exist");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("protects operator routes behind the setup screen when unconfigured", () => {
    goTo("/operator");
    render(<App />);
    expect(screen.getByText("Connect your Supabase project")).toBeInTheDocument();
  });
});

describe("StatusChip", () => {
  it("never relies on colour alone - it prints the status name and a glyph", () => {
    const { container } = render(<StatusChip status="READY_TO_COLLECT" />);
    expect(screen.getByText("Ready to Collect")).toBeInTheDocument();
    expect(container.querySelector("[data-status='READY_TO_COLLECT']")).not.toBeNull();
    expect(screen.getByText(/\u2611/)).toBeInTheDocument();
  });

  it("renders every status with its label", () => {
    const statuses = [
      "PLACED",
      "ACCEPTED",
      "IN_PROGRESS",
      "READY_TO_COLLECT",
      "COLLECTED",
      "REJECTED",
      "CANCELLED",
    ] as const;
    const expected = [
      "Placed",
      "Accepted",
      "In Progress",
      "Ready to Collect",
      "Collected",
      "Rejected",
      "Cancelled",
    ];
    statuses.forEach((status, index) => {
      const { unmount } = render(<StatusChip status={status} />);
      expect(screen.getByText(expected[index])).toBeInTheDocument();
      unmount();
    });
  });
});
