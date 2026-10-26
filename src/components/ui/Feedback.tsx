import type { ReactNode } from "react";
import { Spinner } from "./Primitives";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500">
      <Spinner className="h-7 w-7 text-brand-700" />
      <p className="text-sm">{label}...</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "\u{1f37d}️",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-base font-bold text-stone-800">{title}</h2>
      {description && <p className="max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span className="text-3xl" aria-hidden="true">
        {"\u26a0\ufe0f"}
      </span>
      <h2 className="text-base font-bold text-stone-800">{title}</h2>
      {description && <p className="max-w-md text-sm text-stone-600">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-stone-800 px-4 py-2 text-center text-xs font-semibold text-white"
    >
      You are offline - showing the last loaded data.
    </div>
  );
}
