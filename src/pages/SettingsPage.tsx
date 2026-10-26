import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerShell } from "../components/layout/CustomerShell";
import { Button, Card, Field, Input } from "../components/ui/Primitives";
import { useAuth } from "../features/auth/AuthProvider";
import { useToast } from "../components/ui/Toast";
import { enablePush, disablePush, isPushSupported, pushPermission } from "../features/notifications/push";
import { requireSupabase } from "../lib/supabase";

export default function SettingsPage() {
  const { profile, session, signOut, refreshProfile, isGuest, role } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const saveName = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim().slice(0, 80) })
        .eq("id", session.user.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      notify("Name saved.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save your name.", "error");
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    const granted = pushPermission() === "granted";
    const result = granted ? await disablePush() : await enablePush();
    notify(result.message, result.ok ? "success" : "error");
    setPushBusy(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not sign out.", "error");
    }
  };

  return (
    <CustomerShell title="Settings" subtitle="Your account and preferences">
      <div className="space-y-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Signed in as</p>
          <p className="mt-1 text-sm text-stone-700">
            {isGuest ? "Guest session" : (profile?.display_name ?? session?.user.email ?? "Account")}
          </p>
          <p className="text-xs text-stone-400">
            Role: {role ?? "guest"} &middot; {session?.user.id.slice(0, 8)}...
          </p>
          {isGuest && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Your guest session lives in this browser. If you clear browser data, your orders can no
              longer be recovered on this device.
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <Field label="Display name (optional)" htmlFor="display-name">
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya"
              maxLength={80}
            />
          </Field>
          <Button loading={saving} onClick={() => void saveName()}>
            Save name
          </Button>
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Order notifications
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {isPushSupported()
              ? "Get a notification when your order is accepted, prepared or ready to collect."
              : "This browser does not support push notifications."}
          </p>
          <div className="mt-3">
            <Button
              variant={pushPermission() === "granted" ? "secondary" : "primary"}
              loading={pushBusy}
              disabled={!isPushSupported()}
              onClick={() => void togglePush()}
            >
              {pushPermission() === "granted" ? "Turn notifications off" : "Turn notifications on"}
            </Button>
          </div>
        </Card>

        <Button block variant="secondary" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </div>
    </CustomerShell>
  );
}
