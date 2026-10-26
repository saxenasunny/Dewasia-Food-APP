-- ---------------------------------------------------------------------------
-- Row Level Security. RLS is enabled on every table a browser can reach.
-- The rule of thumb used throughout:
--   * a customer sees only their own orders
--   * the operator sees the canteen's operational data
--   * nobody writes orders / history / prices directly - trusted functions do
-- ---------------------------------------------------------------------------

alter table profiles              enable row level security;
alter table canteens              enable row level security;
alter table menu_categories       enable row level security;
alter table menu_items            enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table order_status_history  enable row level security;
alter table push_subscriptions    enable row level security;
alter table notification_logs     enable row level security;
alter table idempotency_keys      enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own_no_role"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  -- The WITH CHECK can only see the new row, so role tampering is stopped by
  -- the protect_profile_role trigger rather than by this clause.
  with check (id = auth.uid());

-- No insert policy: profiles are created by the auth trigger.
-- No delete policy: profiles are never deleted by clients.

-- ---------------------------------------------------------------------------
-- canteens / menu - readable by everyone, writable only by the operator.
-- ---------------------------------------------------------------------------
create policy "canteens_read"
  on canteens for select
  to anon, authenticated
  using (true);

create policy "canteens_write_operator"
  on canteens for update
  to authenticated
  using (is_operator())
  with check (is_operator());

create policy "categories_read"
  on menu_categories for select
  to anon, authenticated
  using (is_active or is_operator());

create policy "categories_write_operator"
  on menu_categories for all
  to authenticated
  using (is_operator())
  with check (is_operator());

create policy "menu_items_read"
  on menu_items for select
  to anon, authenticated
  using (true);

create policy "menu_items_write_operator"
  on menu_items for all
  to authenticated
  using (is_operator())
  with check (is_operator());

-- ---------------------------------------------------------------------------
-- orders - the core privacy boundary.
--   * INSERT/UPDATE/DELETE: denied for all browser roles.
--     create_order() and update_order_status() are SECURITY DEFINER and
--     therefore bypass RLS; they are the only write path.
--   * SELECT: the owner, or the operator.
-- ---------------------------------------------------------------------------
create policy "orders_read_own_or_operator"
  on orders for select
  to authenticated
  using (user_id = auth.uid() or is_operator());

create policy "orders_no_insert"
  on orders for insert
  to authenticated
  with check (false);

create policy "orders_no_update"
  on orders for update
  to authenticated
  using (false)
  with check (false);

create policy "orders_no_delete"
  on orders for delete
  to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- order_items / history - follow the parent order's visibility.
-- ---------------------------------------------------------------------------
create policy "order_items_read_scoped"
  on order_items for select
  to authenticated
  using (
    exists (
      select 1 from orders o
       where o.id = order_id
         and (o.user_id = auth.uid() or is_operator())
    )
  );

create policy "order_items_no_write"
  on order_items for insert
  to authenticated
  with check (false);

create policy "order_items_no_update"
  on order_items for update
  to authenticated
  using (false) with check (false);

create policy "order_items_no_delete"
  on order_items for delete
  to authenticated
  using (false);

create policy "history_read_scoped"
  on order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from orders o
       where o.id = order_id
         and (o.user_id = auth.uid() or is_operator())
    )
  );

create policy "history_no_insert"
  on order_status_history for insert
  to authenticated
  with check (false);

create policy "history_no_update"
  on order_status_history for update
  to authenticated
  using (false) with check (false);

create policy "history_no_delete"
  on order_status_history for delete
  to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- push_subscriptions - strictly per device owner.
-- ---------------------------------------------------------------------------
create policy "push_read_own"
  on push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "push_insert_own"
  on push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "push_update_own"
  on push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_delete_own"
  on push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_logs / idempotency - own rows only, never writable by clients.
-- ---------------------------------------------------------------------------
create policy "notification_logs_read_own"
  on notification_logs for select
  to authenticated
  using (user_id = auth.uid() or is_operator());

create policy "notification_logs_no_insert"
  on notification_logs for insert
  to authenticated
  with check (false);

create policy "notification_logs_no_delete"
  on notification_logs for delete
  to authenticated
  using (false);

create policy "idempotency_read_own"
  on idempotency_keys for select
  to authenticated
  using (user_id = auth.uid());

create policy "idempotency_no_write"
  on idempotency_keys for insert
  to authenticated
  with check (false);
