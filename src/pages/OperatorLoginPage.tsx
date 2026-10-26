import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, Card, Field, Input, Spinner } from "../components/ui/Primitives";
import { SetupNotice } from "../app/guards";
import { useAuth } from "../features/auth/AuthProvider";

export default function OperatorLoginPage() {
  const { configured, loading, session, isOperator, signInOperator } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <SetupNotice />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-700" />
      </div>
    );
  }

  if (session && isOperator) return <Navigate to="/operator" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInOperator(email.trim(), password);
      navigate("/operator", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
            <span aria-hidden="true">{"\u{1f37d}️"}</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Canteen operator</h1>
          <p className="mt-1 text-sm text-stone-400">Restricted dashboard access</p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="op-email">
              <Input
                id="op-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@college.edu"
              />
            </Field>

            <Field label="Password" htmlFor="op-password">
              <Input
                id="op-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <Button type="submit" block loading={busy}>
              Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-stone-500">
          Only the pre-created operator account can sign in here.
        </p>
        <a
          href="/"
          className="mt-3 block text-center text-sm font-semibold text-brand-400 underline"
        >
          Back to the customer app
        </a>
      </div>
    </div>
  );
}
