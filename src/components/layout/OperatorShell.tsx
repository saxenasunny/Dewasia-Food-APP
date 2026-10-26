import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { OfflineBanner } from "../ui/Feedback";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

const OPERATOR_TABS = [
  { to: "/operator", label: "Order board", icon: "\u{1f4cb}" },
  { to: "/operator/menu", label: "Menu", icon: "\u{1f37d}️" },
  { to: "/operator/reports", label: "Reports", icon: "\u{1f4ca}" },
  { to: "/operator/settings", label: "Settings", icon: "\u2699\ufe0f" },
];

export function OperatorShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const online = useOnlineStatus();
  const location = useLocation();

  return (
    <div className="flex min-h-full flex-col bg-[#f4f1ec]">
      <OfflineBanner online={online} />

      <header className="sticky top-0 z-30 bg-stone-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-stone-400">{subtitle}</p>}
          </div>
          {right}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg bg-stone-700 px-3 py-2 text-sm font-semibold hover:bg-stone-600"
          >
            Sign out
          </button>
        </div>

        <nav aria-label="Operator" className="border-t border-stone-700">
          <ul className="mx-auto flex w-full max-w-6xl overflow-x-auto">
            {OPERATOR_TABS.map((tab) => {
              const active =
                tab.to === "/operator"
                  ? location.pathname === "/operator"
                  : location.pathname.startsWith(tab.to);
              return (
                <li key={tab.to} className="flex-1">
                  <NavLink
                    to={tab.to}
                    end={tab.to === "/operator"}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-semibold ${
                      active
                        ? "border-b-2 border-brand-400 text-white"
                        : "border-b-2 border-transparent text-stone-400 hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    {tab.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
