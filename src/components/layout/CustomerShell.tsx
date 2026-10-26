import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useCart } from "../../features/cart/CartProvider";
import { OfflineBanner } from "../ui/Feedback";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

interface CustomerShellProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  hideNav?: boolean;
  children: ReactNode;
}

const CUSTOMER_TABS = [
  { to: "/menu", label: "Menu", icon: "\u{1f37d}️" },
  { to: "/orders", label: "Orders", icon: "\u{1f4c4}" },
  { to: "/settings", label: "Settings", icon: "\u2699\ufe0f" },
];

export function CustomerShell({ title, subtitle, right, hideNav = false, children }: CustomerShellProps) {
  const { count } = useCart();
  const online = useOnlineStatus();
  const location = useLocation();

  return (
    <div className="flex min-h-full flex-col bg-[#faf7f2]">
      <OfflineBanner online={online} />
      <header className="sticky top-0 z-30 bg-brand-700 text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-brand-100">{subtitle}</p>}
          </div>
          {right}
          <CartButton count={count} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">{children}</main>

      {!hideNav && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex w-full max-w-3xl">
            {CUSTOMER_TABS.map((tab) => {
              const active =
                location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
              return (
                <li key={tab.to} className="flex-1">
                  <NavLink
                    to={tab.to}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                      active ? "text-brand-700" : "text-stone-500"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden="true" className="text-lg leading-none">
                      {tab.icon}
                    </span>
                    {tab.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function CartButton({ count }: { count: number }) {
  return (
    <NavLink
      to="/cart"
      className="relative inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-900/40 px-4 py-2 text-sm font-semibold hover:bg-brand-900/60"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <span aria-hidden="true">{"\u{1f6d2}"}</span>
      Cart
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-brand-800">
          {count}
        </span>
      )}
    </NavLink>
  );
}
