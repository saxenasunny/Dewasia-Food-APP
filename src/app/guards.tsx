import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { LoadingState, EmptyState } from "../components/ui/Feedback";
import { Button } from "../components/ui/Primitives";

/** Blocks until the session is known, then requires any signed-in user. */
function RequireSession() {
  const { configured, session, loading } = useAuth();
  const location = useLocation();

  if (!configured) return <SetupNotice />;
  if (loading) return <LoadingState label="Checking your session" />;
  if (!session) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Only the pre-created canteen operator account may enter. */
function RequireOperator() {
  const { configured, session, loading, isOperator } = useAuth();
  const location = useLocation();

  if (!configured) return <SetupNotice />;
  if (loading) return <LoadingState label="Checking your session" />;
  if (!session) return <Navigate to="/operator/login" replace state={{ from: location.pathname }} />;
  if (!isOperator) return <AccessDenied />;
  return <Outlet />;
}

function AccessDenied() {
  const { signOut } = useAuth();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <EmptyState
        icon={"\u{1f6aa}"}
        title="Operator access required"
        description="This account is not authorised for the canteen dashboard. Sign in with the operator account to continue."
        action={
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        }
      />
    </div>
  );
}

/** Shown when the project has no Supabase credentials yet. */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={"\u{1f9f1}"}
        title="Connect your Supabase project"
        description="This app needs a Supabase project to store the menu and orders."
        action={
          <ol className="mt-2 w-full space-y-3 text-left text-sm text-stone-700">
            <li className="rounded-xl bg-white p-3 shadow-[var(--shadow-card)]">
              <strong>1.</strong> Copy <code className="rounded bg-stone-100 px-1">.env.example</code>{" "}
              to <code className="rounded bg-stone-100 px-1">.env</code> and fill in your project URL
              and anon key.
            </li>
            <li className="rounded-xl bg-white p-3 shadow-[var(--shadow-card)]">
              <strong>2.</strong> Run the three files in{" "}
              <code className="rounded bg-stone-100 px-1">supabase/migrations</code>, then{" "}
              <code className="rounded bg-stone-100 px-1">supabase/seed.sql</code>.
            </li>
            <li className="rounded-xl bg-white p-3 shadow-[var(--shadow-card)]">
              <strong>3.</strong> Enable Anonymous sign-ins, then restart the dev server.
            </li>
          </ol>
        }
      />
    </div>
  );
}

export default RequireSession;
export { RequireOperator };
