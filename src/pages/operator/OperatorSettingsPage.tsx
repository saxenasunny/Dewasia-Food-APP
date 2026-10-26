import { useEffect, useState } from "react";
import { OperatorShell } from "../../components/layout/OperatorShell";
import { Button, Card, Field, Input, Pill } from "../../components/ui/Primitives";
import { LoadingState } from "../../components/ui/Feedback";
import { useCanteen } from "../../hooks/useCanteen";
import { useToast } from "../../components/ui/Toast";
import { requireSupabase } from "../../lib/supabase";

export default function OperatorSettingsPage() {
  const { canteen, loading, reload } = useCanteen();
  const { notify } = useToast();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [wait, setWait] = useState("");
  const [pickup, setPickup] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canteen) return;
    setName(canteen.name);
    setLocation(canteen.location_label);
    setWait(canteen.estimated_wait_message);
    setPickup(canteen.pickup_instructions);
  }, [canteen]);

  if (loading || !canteen) {
    return (
      <OperatorShell title="Canteen settings" subtitle="Loading">
        <LoadingState label="Loading settings" />
      </OperatorShell>
    );
  }

  const patch = async (changes: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase.from("canteens").update(changes).eq("id", canteen.id);
      if (error) throw new Error(error.message);
      notify(successMessage, "success");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () =>
    patch(
      {
        name: name.trim().slice(0, 120) || canteen.name,
        location_label: location.trim(),
        estimated_wait_message: wait.trim(),
        pickup_instructions: pickup.trim(),
      },
      "Settings saved.",
    );

  return (
    <OperatorShell title="Canteen settings" subtitle={canteen.name}>
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                Ordering state
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                When closed, customers can browse the menu but cannot place orders.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={canteen.is_open ? "open" : "closed"}>
                <span aria-hidden="true">{canteen.is_open ? "\u25cf" : "\u25a0"}</span>
                {canteen.is_open ? "Open" : "Closed"}
              </Pill>
              <Button
                variant={canteen.is_open ? "danger" : "success"}
                loading={saving}
                onClick={() =>
                  void patch(
                    { is_open: !canteen.is_open },
                    canteen.is_open ? "Canteen closed." : "Canteen opened.",
                  )
                }
              >
                {canteen.is_open ? "Close canteen" : "Open canteen"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                Customer cancellation
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                When enabled, customers may cancel an order while it is still <em>Placed</em>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={canteen.allow_customer_cancellation ? "open" : "closed"}>
                {canteen.allow_customer_cancellation ? "Allowed" : "Not allowed"}
              </Pill>
              <Button
                variant="secondary"
                loading={saving}
                onClick={() =>
                  void patch(
                    { allow_customer_cancellation: !canteen.allow_customer_cancellation },
                    canteen.allow_customer_cancellation
                      ? "Customer cancellation disabled."
                      : "Customer cancellation enabled.",
                  )
                }
              >
                {canteen.allow_customer_cancellation ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Counter details
          </h2>
          <Field label="Canteen name" htmlFor="canteen-name">
            <Input id="canteen-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Location" htmlFor="canteen-location">
            <Input
              id="canteen-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ground floor, Block A"
            />
          </Field>
          <Field
            label="Estimated wait"
            htmlFor="canteen-wait"
            hint="Shown to customers while they order"
          >
            <Input
              id="canteen-wait"
              value={wait}
              onChange={(e) => setWait(e.target.value)}
              placeholder="About 10 minutes"
            />
          </Field>
          <Field label="Pickup instructions" htmlFor="canteen-pickup">
            <Input
              id="canteen-pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              maxLength={300}
            />
          </Field>
          <Button loading={saving} onClick={() => void saveDetails()}>
            Save details
          </Button>
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Operator account
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Role changes are done from the Supabase SQL editor with{" "}
            <code className="rounded bg-stone-100 px-1">set_user_role(...)</code> - the dashboard
            never lets an account promote itself.
          </p>
        </Card>
      </div>
    </OperatorShell>
  );
}
