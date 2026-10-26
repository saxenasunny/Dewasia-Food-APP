# Campus Canteen - Digital Ordering System

A mobile-first PWA for a college canteen: students and visitors browse the menu, order from a
phone, get a pickup token and watch their order move through the kitchen in real time, while a
single canteen operator runs everything from one dashboard.

Built to the *College Canteen Digital Ordering System* blueprint (Version 1.0).

---

## What is implemented

| Area | Status |
| --- | --- |
| Guest ordering (anonymous session, no email/phone) | ✅ |
| Restricted canteen operator login | ✅ |
| Menu with categories, search, availability and sold-out state | ✅ |
| Cart, checkout, pay-at-counter notice | ✅ |
| Server-side order creation (re-pricing, availability, idempotency) | ✅ |
| Unique human-readable pickup token (`C-00001`) | ✅ |
| Full status workflow + enforced transitions | ✅ |
| Operator order board with reason-required reject/cancel | ✅ |
| Live customer tracking (Supabase Realtime, refetch on reconnect) | ✅ |
| Order history and status audit trail | ✅ |
| Operator menu manager and daily report | ✅ |
| Canteen open/closed, cancellation policy, pickup text | ✅ |
| Web push (service worker + VAPID + Edge Function) | ✅ |
| PWA manifest + installable | ✅ |
| RLS on every exposed table | ✅ |
| Online payments | ❌ Out of scope for Version 1 |
| College SSO / email OTP | ❌ Not in this build (guest + operator only) |

---

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS 4 + React Router 6
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions, RLS)
- **Push:** Web Push (VAPID) via a Supabase Edge Function
- **Tests:** Vitest + Testing Library

---

## Project structure

```
public/
  manifest.webmanifest      PWA manifest
  service-worker.js         install caching + push display
  icons/
src/
  App.tsx                   providers + router
  app/
    router.tsx              route table
    guards.tsx              session/operator guards, setup notice
  components/
    layout/                 customer + operator shells, bottom nav
    ui/                     buttons, cards, status chips, dialogs, toasts
  features/
    auth/                   session, guest sign-in, operator sign-in
    cart/                   persisted cart state
    notifications/          push subscribe/unsubscribe + sender call
    orders/                 order API (create, transition, fetch)
  hooks/                    useCanteen, useMenu, useOrder, useOrderUpdates
  lib/                      supabase client, status machine, cart, validation, formatting
  pages/                    customer screens
  pages/operator/           board, menu manager, reports, settings
supabase/
  migrations/               0001 schema, 0002 functions, 0003 RLS
  functions/                send-push-notification
  seed.sql                  sample canteen + menu
tests/                      37 unit + DOM tests
.env.example                every variable name, placeholders only
```

---

## Local setup

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Create the database

**Option A - local stack (Docker), no Supabase account needed:**

```bash
npx supabase start          # first run pulls the Docker images
npx supabase db reset       # applies supabase/migrations/* then supabase/seed.sql
npx supabase status         # copy the URL and anon key into .env
```

> **Windows note:** Supabase's default local ports (54320-54329) often fall inside a
> Hyper-V/Windows *excluded port range*, which makes `supabase start` fail with
> `ports are not available`. Check with `netsh interface ipv4 show excludedportrange protocol=tcp`;
> if they collide, change the `port` / `shadow_port` values in `supabase/config.toml` to a free
> range (this repo uses 55320-55329).

**Option B - hosted project:** create a project at supabase.com, then run the three files in
`supabase/migrations/` followed by `supabase/seed.sql` in the SQL editor (in that order).

### 3. Configure auth

In **Authentication → Sign In / Providers**, enable **Anonymous** sign-ins. That is what
`Continue as Guest` uses. No email provider is required for Version 1.

### 4. Fill `.env`

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_VAPID_PUBLIC_KEY=...      # optional, only needed for push
```

### 5. Run

```bash
npm run dev        # http://localhost:5173
npm run typecheck
npm test
npm run build
```

---

## Creating the operator account

The dashboard never lets anyone promote themselves. Create the user, then promote it from the
SQL editor (the trigger permits direct changes from the `postgres` console role only):

```sql
-- after signing up once with the operator's email, or via:
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (gen_random_uuid(), 'operator@college.edu', crypt('a-strong-password', gen_salt('bf')), now());

update profiles set role = 'operator'
 where id = (select id from auth.users where email = 'operator@college.edu');
```

Inside application code the only path is `set_user_role(user_id, 'operator')`, which requires the
caller to already be an `admin`. Ordinary users always have `role = guest/student`, and a client
UPDATE that touches `role` is rejected by a database trigger.

---

## Push notifications

Push is best-effort: the app works fully without it.

```bash
npx web-push generate-vapid-keys
# public key -> VITE_VAPID_PUBLIC_KEY in .env
# private key -> server-side only:

npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:you@example.com

npx supabase functions deploy send-push-notification
```

Permission is requested **only** from a user action (the tracking page card or Settings), never on
first load. Notifications are sent server-side after a validated status change; the browser never
holds a service credential. Logs land in `notification_logs` with `provider_status` describing each
attempt, and a `404/410` response deactivates the dead subscription.

**Platform notes:** iOS/iPadOS deliver web push only for sites added to the Home Screen on
supported versions. Test on the actual student devices before relying on it.

---

## Security model

- RLS is enabled on **every** table the browser can reach.
- Customers read only rows where `orders.user_id = auth.uid()`; the operator reads operational rows.
- **Nobody** can `INSERT`/`UPDATE`/`DELETE` orders, order items or status history from the client.
  `create_order()` and `update_order_status()` are `SECURITY DEFINER` functions and are the only
  write path - they re-price every line, re-check availability, re-read the canteen state and write
  the audit row.
- Idempotency keys are claimed **before** the order row exists, so a retried request cannot produce
  a second order; a repeat returns the original.
- Status transitions are validated in the app (`src/lib/orderStatus.ts`) **and** again by a
  database trigger, so no code path can skip the rules.
- Roles cannot be changed by clients (trigger + `set_user_role`).
- Rejection and cancellation require a reason, stored on the order and in the history.
- Money is `numeric(10,2)`; client-submitted totals are never trusted.
- The pickup token is a display identifier, not a secret. Cross-device guest recovery uses the
  separate high-entropy `orders.tracking_token`.

### Known limitations (documented, not hidden)

- The operator policy is `is_operator()` with no per-canteen scoping; with a single canteen in
  Version 1 this is correct, but a second outlet needs `canteen_id` added to the policy.
- No rate limiting / CAPTCHA on order submission yet - add before a public launch.
- No automated test runs against a live database; the SQL is validated against a local Supabase
  stack, while unit tests cover the client-side state machine, cart and validation.

---

## Testing

```bash
npm test
```

38 tests covering:

- every allowed and forbidden status transition, including terminal states
- cart merging, quantity caps, persistence, corrupt storage, menu reconciliation
- order payload validation (quantities, duplicates, note length, idempotency key)
- money/date formatting and order-age display
- DOM checks: setup notice, 404 route, and that status chips always pair colour with text and a glyph

### Integration smoke test (needs a running stack)

```bash
./scripts/security-smoke.sh
```

25 assertions against the real database over HTTP, using two anonymous guests plus the operator
account. It proves order creation and server-side re-pricing, idempotent retries, sold-out and
quantity rejection, that clients cannot UPDATE order status, that guest B cannot read guest A's
cross-guest reads are blocked, that role escalation is refused, the full allowed transition chain
(including refused stage-skips and reason-less rejections), and that every transition lands in the
audit trail.

---

## Operational checklist before launch

- [ ] Confirm menu, prices, hours, pickup location and cancellation rules with the canteen owner
- [ ] Create and test the operator account; confirm account recovery
- [ ] Test push on the real phones students use
- [ ] Print QR codes linking to the site for the entrance and common areas
- [ ] Write a paper fallback procedure for internet outages
- [ ] Configure database backups for your Supabase plan
- [ ] Review retention/privacy for anonymous users with the college
