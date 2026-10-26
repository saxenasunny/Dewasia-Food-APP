import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        {"\u{1f50d}"}
      </p>
      <h1 className="text-xl font-bold text-stone-900">Page not found</h1>
      <p className="text-sm text-stone-600">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800"
      >
        Back to home
      </Link>
    </div>
  );
}
