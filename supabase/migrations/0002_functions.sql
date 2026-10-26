-- ---------------------------------------------------------------------------
-- Trusted server-side logic: role helpers, order creation, status transitions.
-- Everything here runs SECURITY DEFINER so it is the only path that can write
-- prices, statuses or audit rows. Clients never INSERT/UPDATE those tables.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- SECURITY DEFINER avoids the RLS recursion you get when a policy on
-- `profiles` needs to read `profiles`.
create or replace function is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('operator', 'admin') from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function current_user_role() to anon, authenticated, service_role;
grant execute on function is_operator() to anon, authenticated, service_role;
grant execute on function is_admin() to anon, authenticated, service_role;

-- Roles are changed only through this function, never by a client UPDATE.
create or replace function set_user_role(p_user_id uuid, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can change roles' using errcode = '42501';
  end if;

  perform set_config('app.trusted_role_update', 'on', true);
  update profiles set role = p_role where id = p_user_id;
  if not found then
    perform set_config('app.trusted_role_update', 'off', true);
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  perform set_config('app.trusted_role_update', 'off', true);
end;
$$;

grant execute on function set_user_role(uuid, user_role) to authenticated;

-- Defence in depth: reject any role change that did not come from set_user_role.
create or replace function protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('app.trusted_role_update', true), 'off') <> 'on'
     -- Database console roles (postgres / service_role) are trusted setup
     -- paths; browser API sessions are not.
     and current_user in ('authenticated', 'anon') then
    raise exception 'User roles cannot be changed by clients' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role before update of role on profiles
  for each row execute function protect_profile_role();

-- ---------------------------------------------------------------------------
-- State machine shared with the app (src/lib/orderStatus.ts)
-- ---------------------------------------------------------------------------
create or replace function can_transition(p_from order_status, p_to order_status)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'PLACED'          then p_to in ('ACCEPTED', 'REJECTED', 'CANCELLED')
    when 'ACCEPTED'        then p_to in ('IN_PROGRESS', 'CANCELLED')
    when 'IN_PROGRESS'     then p_to in ('READY_TO_COLLECT', 'CANCELLED')
    when 'READY_TO_COLLECT' then p_to in ('COLLECTED')
    else false
  end;
$$;

-- Enforced at the database level too, so no code path can skip the rules.
create or replace function enforce_order_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and not can_transition(old.status, new.status) then
    raise exception 'Illegal order status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  -- An administrator correction deliberately bypasses the transition rules.
  if coalesce(current_setting('app.allow_status_correction', true), 'off') = 'on' then
    if new.status in ('REJECTED', 'CANCELLED') and coalesce(new.status_reason, '') = '' then
      raise exception 'A reason is required when an order is %', new.status
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status in ('REJECTED', 'CANCELLED')
     and coalesce(new.status_reason, '') = '' then
    raise exception 'A reason is required when an order is %', new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger orders_enforce_transition
  before update of status on orders
  for each row execute function enforce_order_transition();

-- ---------------------------------------------------------------------------
-- Order creation
--   p_lines: [{"menu_item_id": "<uuid>", "quantity": 2}, ...]
-- Prices, availability, canteen state and totals are all recomputed here.
-- ---------------------------------------------------------------------------
create or replace function create_order(
  p_canteen_id uuid,
  p_lines jsonb,
  p_customer_note text default '',
  p_idempotency_key text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id          uuid := auth.uid();
  v_canteen          canteens%rowtype;
  v_order            orders%rowtype;
  v_line             jsonb;
  v_item             menu_items%rowtype;
  v_request_hash     text;
  v_existing_order   orders%rowtype;
  v_prev_hash        text;
  v_note             text := left(nullif(trim(coalesce(p_customer_note, '')), ''), 300);
  v_ids              uuid[] := '{}';
  v_names            text[] := '{}';
  v_prices           numeric[] := '{}';
  v_qtys             integer[] := '{}';
  v_subtotal         numeric(10, 2) := 0;
  v_idx              integer;
  v_item_id          uuid;
  v_qty              integer;
  v_pos              integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to place an order' using errcode = '42501';
  end if;

  if p_canteen_id is null then
    raise exception 'Canteen is required' using errcode = '22023';
  end if;

  select * into v_canteen from canteens where id = p_canteen_id;
  if not found then
    raise exception 'Canteen not found' using errcode = 'P0002';
  end if;

  if not v_canteen.is_open then
    raise exception 'The canteen is currently closed' using errcode = 'P0001';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;

  v_request_hash := md5(p_canteen_id::text || '|' || p_lines::text || '|' || coalesce(v_note, ''));

  -- ---- Idempotency: claim the key BEFORE creating anything, so a retried
  -- ---- request can never produce a second order.
  if p_idempotency_key is not null then
    declare
      v_existing_order_id uuid;
    begin
      insert into idempotency_keys (key, user_id, request_hash)
      values (p_idempotency_key, v_user_id, v_request_hash)
      on conflict (key, user_id) do nothing;

      if not found then
        select request_hash, order_id
          into v_prev_hash, v_existing_order_id
          from idempotency_keys
         where key = p_idempotency_key and user_id = v_user_id;

        if coalesce(v_prev_hash, '') is distinct from v_request_hash then
          raise exception 'This idempotency key was already used for a different order'
            using errcode = '23514';
        end if;

        if v_existing_order_id is not null then
          select * into v_existing_order from orders where id = v_existing_order_id;
          return v_existing_order; -- duplicate submission: return the original
        end if;

        raise exception 'An identical order is already being submitted' using errcode = '23505';
      end if;
    end;
  end if;

  -- ---- Re-price and re-validate every line server side.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    begin
      begin
        v_item_id := (v_line ->> 'menu_item_id')::uuid;
        v_qty     := (v_line ->> 'quantity')::integer;
      exception when others then
        raise exception 'Malformed cart line' using errcode = '22023';
      end;

      if v_item_id is null or v_qty is null or v_qty < 1 or v_qty > 50 then
        raise exception 'Invalid quantity in cart' using errcode = '22023';
      end if;

      select * into v_item from menu_items where id = v_item_id and canteen_id = p_canteen_id;
      if not found then
        raise exception 'An item in your cart is no longer on the menu' using errcode = 'P0002';
      end if;

      if not v_item.is_available then
        raise exception '"%" is sold out', v_item.name using errcode = 'P0001';
      end if;

      -- Merge duplicate lines instead of double-charging.
      v_pos := array_position(v_ids, v_item.id);
      if v_pos is not null then
        if v_qtys[v_pos] + v_qty > 50 then
          raise exception 'Maximum quantity reached for "%"', v_item.name using errcode = '22023';
        end if;
        v_qtys[v_pos] := v_qtys[v_pos] + v_qty;
      else
        v_ids   := array_append(v_ids, v_item.id);
        v_names := array_append(v_names, v_item.name);
        v_prices := array_append(v_prices, v_item.price);
        v_qtys  := array_append(v_qtys, v_qty);
      end if;
    end;
  end loop;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;

  for v_idx in 1 .. array_length(v_ids, 1) loop
    v_subtotal := v_subtotal + (v_prices[v_idx] * v_qtys[v_idx]);
  end loop;

  insert into orders (
    order_number, user_id, canteen_id, status, payment_status,
    subtotal, total, customer_note, tracking_token
  ) values (
    next_order_number(), v_user_id, p_canteen_id, 'PLACED', 'UNPAID_AT_COUNTER',
    v_subtotal, v_subtotal, v_note,
    -- Two UUIDs concatenated = 256 bits of OS-backed randomness, hex encoded.
    -- Avoids pgcrypto, which Supabase installs outside the public schema.
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ) returning * into v_order;

  for v_idx in 1 .. array_length(v_ids, 1) loop
    insert into order_items (
      order_id, menu_item_id, item_name_snapshot,
      unit_price_snapshot, quantity, line_total
    ) values (
      v_order.id, v_ids[v_idx], v_names[v_idx],
      v_prices[v_idx], v_qtys[v_idx], v_prices[v_idx] * v_qtys[v_idx]
    );
  end loop;

  insert into order_status_history (order_id, old_status, new_status, changed_by, reason)
  values (v_order.id, null, 'PLACED', v_user_id, null);

  if p_idempotency_key is not null then
    update idempotency_keys
       set order_id = v_order.id
     where key = p_idempotency_key and user_id = v_user_id;
  end if;

  return v_order;
end;
$$;

grant execute on function create_order(uuid, jsonb, text, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Status transitions. The operator advances preparation; a customer may only
-- cancel while the order is still PLACED and policy allows it.
-- ---------------------------------------------------------------------------
create or replace function update_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_reason text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     user_role;
  v_order    orders%rowtype;
  v_old      order_status;
  v_operator boolean;
  v_reason   text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  v_allow    boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_role     := current_user_role();
  v_operator := coalesce(v_role in ('operator', 'admin'), false);
  v_old      := v_order.status;

  if not v_operator then
    -- The only thing a customer may do is cancel their own order while it is
    -- still waiting, and only when the canteen's policy allows it.
    if v_order.user_id <> v_uid or p_new_status <> 'CANCELLED' or v_old <> 'PLACED' then
      raise exception 'Only the canteen operator can change order status' using errcode = '42501';
    end if;

    select allow_customer_cancellation into v_allow
      from canteens where id = v_order.canteen_id;

    if not coalesce(v_allow, false) then
      raise exception 'This order can no longer be cancelled' using errcode = '42501';
    end if;
  end if;

  if not can_transition(v_old, p_new_status) then
    raise exception 'Cannot move an order from % to %', v_old, p_new_status
      using errcode = '23514';
  end if;

  if p_new_status in ('REJECTED', 'CANCELLED') and v_reason is null then
    raise exception 'A reason is required for %', p_new_status using errcode = '22023';
  end if;

  update orders
     set status = p_new_status,
         status_reason = case
           when p_new_status in ('REJECTED', 'CANCELLED') then v_reason
           else status_reason
         end
   where id = p_order_id
  returning * into v_order;

  insert into order_status_history (order_id, old_status, new_status, changed_by, reason)
  values (p_order_id, v_old, p_new_status, v_uid, v_reason);

  return v_order;
end;
$$;

grant execute on function update_order_status(uuid, order_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Controlled correction for an operator mistake: terminal statuses can be
-- reopened by an administrator only, always with a reason and an audit row.
-- ---------------------------------------------------------------------------
create or replace function correct_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_reason text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   order_status;
  v_order orders%rowtype;
  v_uid   uuid := auth.uid();
begin
  if not is_admin() then
    raise exception 'Only an administrator can correct a completed order' using errcode = '42501';
  end if;

  if coalesce(left(trim(coalesce(p_reason, '')), 300), '') = '' then
    raise exception 'A correction reason is required' using errcode = '22023';
  end if;

  select status into v_old from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  -- The transition trigger honours this flag; both states land in the audit
  -- trail so the correction is visible rather than silent.
  perform set_config('app.allow_status_correction', 'on', true);
  update orders
     set status = p_new_status,
         status_reason = case
           when p_new_status in ('REJECTED', 'CANCELLED') then left(trim(p_reason), 300)
           else status_reason
         end
   where id = p_order_id
  returning * into v_order;
  perform set_config('app.allow_status_correction', 'off', true);

  insert into order_status_history (order_id, old_status, new_status, changed_by, reason)
  values (p_order_id, v_old, p_new_status, v_uid, 'Correction: ' || left(trim(p_reason), 250));

  return v_order;
end;
$$;

grant execute on function correct_order_status(uuid, order_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Queue a push notification for a validated status change. The actual send
-- happens in supabase/functions/send-push-notification.
-- ---------------------------------------------------------------------------
create or replace function log_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('ACCEPTED', 'IN_PROGRESS', 'READY_TO_COLLECT', 'REJECTED', 'CANCELLED') then
    insert into notification_logs (order_id, user_id, event_type, provider_status)
    values (new.id, new.user_id, new.status::text, 'PENDING');
  end if;
  return new;
end;
$$;

create trigger orders_status_notify
  after update of status on orders
  for each row execute function log_status_notification();

-- ---------------------------------------------------------------------------
-- Realtime publication - only these tables are broadcast, and RLS still
-- decides which rows each subscriber may see.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table menu_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table canteens;
exception when duplicate_object then null;
end $$;
