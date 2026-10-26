export function Stepper({
  quantity,
  onChange,
  label,
  min = 0,
  max = 50,
}: {
  quantity: number;
  onChange: (next: number) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-xl bg-brand-50 ring-1 ring-brand-200">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, quantity - 1))}
        disabled={quantity <= min}
        aria-label={`Decrease quantity of ${label}`}
        className="h-10 w-10 text-lg font-bold text-brand-800 hover:bg-brand-100 disabled:text-stone-400"
      >
        {"\u2212"}
      </button>
      <span aria-live="polite" className="w-9 text-center text-sm font-bold text-brand-900">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        aria-label={`Increase quantity of ${label}`}
        className="h-10 w-10 text-lg font-bold text-brand-800 hover:bg-brand-100 disabled:text-stone-400"
      >
        {"+"}
      </button>
    </div>
  );
}
