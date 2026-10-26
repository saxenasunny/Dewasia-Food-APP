import { useEffect, useState } from "react";
import { Button, Field } from "./Primitives";

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Rejection and cancellation always require a reason, per the business rules. */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  if (!open) return null;

  const invalid = reason.trim().length < 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reason-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="reason-title" className="text-lg font-bold text-stone-900">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-stone-600">{description}</p>}

        <div className="mt-4">
          <Field
            label="Reason (shared with the customer)"
            htmlFor="reason-input"
            error={touched && invalid ? "Give a short reason - at least 3 characters." : undefined}
          >
            <textarea
              id="reason-input"
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Ran out of paneer"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base focus:border-brand-600 focus:outline-none"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="danger"
            loading={busy}
            className="sm:flex-1"
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" disabled={busy} className="sm:flex-1" onClick={onCancel}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
