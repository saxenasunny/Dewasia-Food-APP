-- ---------------------------------------------------------------------------
-- Campus Canteen Digital Ordering System - core schema
-- Run with: supabase db push  (or paste into the SQL editor)
-- ---------------------------------------------------------------------------

-- No extensions required: gen_random_uuid() is built into PostgreSQL 13+ and
-- every random token below is derived from it.

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type user_role as enum ('student', 'guest', 'operator', 'admin');

create type order_status as enum (
  'PLACED',
  'ACCEPTED',
  'IN_PROGRESS',
  'READY_TO_COLLECT',
  'COLLECTED',
  'REJECTED',
  'CANCELLED'
);

create type payment_status as enum (
  'UNPAID_AT_COUNTER',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- ---------------------------------------------------------------------------
-- profiles - one row per auth user. `role` is never client-editable.
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role user_role not null default 'guest',
  college_identifier text,
  created_at timestamptz not null default now(),
  constraint display_name_length check (display_name is null or char_length(display_name) <= 80)
);

-- ---------------------------------------------------------------------------
-- canteens - modelled from day one so a second outlet can be added later.
-- ---------------------------------------------------------------------------
create table canteens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_label text not null default '',
  is_open boolean not null default true,
  allow_customer_cancellation boolean not null default true,
  estimated_wait_message text not null default 'About 10 minutes',
  pickup_instructions text not null default 'Collect your order at the main counter and show your pickup token.',
  created_at timestamptz not null default now(),
  constraint canteen_name_length check (char_length(name) between 1 and 120)
);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  canteen_id uuid not null references canteens (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint category_name_length check (char_length(name) between 1 and 60)
);

create index menu_categories_canteen_sort_idx on menu_categories (canteen_id, sort_order);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  canteen_id uuid not null references canteens (id) on delete cascade,
  category_id uuid not null references menu_categories (id) on delete cascade,
  name text not null,
  description text,
  -- Money is never stored as floating point.
  price numeric(10, 2) not null check (price >= 0 and price <= 100000),
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_name_length check (char_length(name) between 1 and 120),
  constraint item_description_length check (description is null or char_length(description) <= 500)
);

create index menu_items_category_sort_idx on menu_items (category_id, sort_order);
create index menu_items_canteen_available_idx on menu_items (canteen_id, is_available);

-- ---------------------------------------------------------------------------
-- orders / order_items
-- ---------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict,
  canteen_id uuid not null references canteens (id) on delete restrict,
  status order_status not null default 'PLACED',
  payment_status payment_status not null default 'UNPAID_AT_COUNTER',
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  total numeric(10, 2) not null check (total >= 0),
  customer_note text check (customer_note is null or char_length(customer_note) <= 300),
  -- Reason attached to a REJECTED or CANCELLED order; always set with those statuses.
  status_reason text check (status_reason is null or char_length(status_reason) <= 300),
  -- High-entropy token for optional cross-device tracking. Never the pickup token.
  tracking_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_created_idx on orders (user_id, created_at desc);
create index orders_canteen_status_created_idx on orders (canteen_id, status, created_at);
create index orders_canteen_created_idx on orders (canteen_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid references menu_items (id) on delete set null,
  -- Snapshots keep old receipts correct when the menu changes.
  item_name_snapshot text not null,
  unit_price_snapshot numeric(10, 2) not null check (unit_price_snapshot >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 50),
  line_total numeric(10, 2) not null check (line_total >= 0),
  constraint snapshot_name_length check (char_length(item_name_snapshot) between 1 and 120)
);

create index order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------------
-- Audit trail - written only by trusted functions.
-- ---------------------------------------------------------------------------
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  old_status order_status,
  new_status order_status not null,
  changed_by uuid,
  reason text check (reason is null or char_length(reason) <= 300),
  changed_at timestamptz not null default now()
);

create index order_status_history_order_idx on order_status_history (order_id, changed_at);

-- ---------------------------------------------------------------------------
-- Web push
-- ---------------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index push_subscriptions_user_idx on push_subscriptions (user_id, is_active);

create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  event_type text not null,
  provider_status text not null default 'PENDING',
  attempted_at timestamptz not null default now()
);

create index notification_logs_order_idx on notification_logs (order_id, event_type);

-- ---------------------------------------------------------------------------
-- Idempotency - prevents duplicate orders when a request is retried.
-- ---------------------------------------------------------------------------
create table idempotency_keys (
  key text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_hash text not null,
  order_id uuid references orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (key, user_id)
);

create index idempotency_keys_created_idx on idempotency_keys (created_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger menu_items_touch before update on menu_items
  for each row execute function touch_updated_at();

create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile (role always starts as 'guest').
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    -- An anonymous sign-in is a guest; anything else defaults to student.
    case when new.is_anonymous then 'guest'::user_role else 'student'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Order number: human-readable, globally unique, sequence based.
-- A pickup token is a display identifier, never an authorization secret.
-- ---------------------------------------------------------------------------
create sequence order_number_seq start 1;

create or replace function next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'C-' || lpad(nextval('order_number_seq')::text, 5, '0');
end;
$$;
