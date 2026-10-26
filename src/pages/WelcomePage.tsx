import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { Button, Pill, Spinner } from "../components/ui/Primitives";
import { SetupNotice } from "../app/guards";
import { useCanteen } from "../hooks/useCanteen";

export default function WelcomePage() {
  const { configured, session, loading, continueAsGuest, isOperator } = useAuth();
  const { canteen } = useCanteen();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <SetupNotice />;

  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!session) await continueAsGuest();
      navigate("/menu", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a guest session.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-700" />
      </div>
    );
  }

  // Already signed in - skip the gate and go straight to the menu.
  if (session && !isOperator) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <Spinner className="h-8 w-8 text-brand-700" />
        <p className="text-sm text-stone-600">Opening the menu...</p>
        <Button onClick={() => navigate("/menu", { replace: true })}>Browse the menu</Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-brand-700">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-10 text-white">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl">
            <span aria-hidden="true">{"\u{1f35c}"}</span>
          </div>
          <h1 className="mt-6 text-3xl font-black leading-tight">
            {canteen?.name ?? "Campus Canteen"}
          </h1>
          <p className="mt-3 text-brand-100">
            Browse the menu, order from your phone, get a pickup token and collect when it is ready.
          </p>
          <div className="mt-4">
            <Pill tone={canteen?.is_open ? "open" : "closed"}>
              <span aria-hidden="true">{canteen?.is_open ? "\u25cf" : "\u25a0"}</span>
              {canteen?.is_open ? "Open now" : "Closed right now"}
            </Pill>
          </div>
          {canteen?.location_label && (
            <p className="mt-3 text-sm text-brand-100">
              <span aria-hidden="true">{"\u{1f4cd}"}</span> {canteen.location_label}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-white">
              {error}
            </p>
          )}

          <Button block loading={busy} onClick={() => void enter()} className="!bg-white !text-brand-800">
            Continue as Guest
          </Button>

          <Link
            to="/operator/login"
            className="block w-full rounded-xl px-5 py-3 text-center text-base font-semibold text-white ring-1 ring-white/50 hover:bg-white/10"
          >
            Canteen Operator Login
          </Link>

          <p className="text-center text-xs text-brand-100">
            No email or phone number needed to order as a guest.
          </p>
        </div>
      </div>
    </div>
  );
}
