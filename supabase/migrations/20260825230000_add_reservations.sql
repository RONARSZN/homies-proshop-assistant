-- Reservations hold stock operationally without creating a stock movement.
-- On conversion, the existing transactional sale path creates the sale and
-- deducts stock atomically before the reservation is marked converted.

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  note text,
  status text not null default 'reserved' check (status in ('reserved', 'converted', 'cancelled')),
  reserved_at timestamptz not null default now(),
  expires_at date,
  converted_sale_id uuid references public.sales(id),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (reservation_id, product_id)
);

create index reservations_status_idx on public.reservations(status);
create index reservation_items_product_id_idx on public.reservation_items(product_id);

alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;

create policy reservations_read_authenticated
on public.reservations for select to authenticated
using (true);

create policy reservations_insert_staff
on public.reservations for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
);

create policy reservations_update_staff
on public.reservations for update to authenticated
using (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
  and status = 'reserved'
)
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
  and status in ('reserved', 'converted', 'cancelled')
);

create policy reservation_items_read_authenticated
on public.reservation_items for select to authenticated
using (true);

create policy reservation_items_insert_staff
on public.reservation_items for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and exists (
    select 1 from public.reservations
    where reservations.id = reservation_items.reservation_id
      and reservations.created_by = (select auth.uid())
      and reservations.status = 'reserved'
  )
);

revoke all on table public.reservations, public.reservation_items from anon;
grant select, insert, update on table public.reservations to authenticated;
grant select, insert on table public.reservation_items to authenticated;

create function public.create_reservation(
  p_items jsonb,
  p_customer_name text default null,
  p_note text default null,
  p_expires_at date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reservation_id uuid := gen_random_uuid();
  product_record record;
begin
  if (select private.current_user_role()) not in ('owner', 'manager', 'staff') then
    raise exception 'A shop role is required.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one reservation item is required.' using errcode = 'check_violation';
  end if;

  for product_record in
    select distinct (item->>'product_id')::uuid as product_id
    from jsonb_array_elements(p_items) item
    order by product_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(product_record.product_id::text, 0));
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    left join public.products on products.id = (item->>'product_id')::uuid
    left join public.product_stock on product_stock.product_id = products.id
    where products.id is null
      or not products.is_active
      or (item->>'qty')::integer <= 0
      or coalesce(product_stock.on_hand, 0) - coalesce((
        select sum(ri.qty)
        from public.reservation_items ri
        join public.reservations r on r.id = ri.reservation_id
        where ri.product_id = products.id and r.status = 'reserved'
      ), 0) < (item->>'qty')::integer
  ) then
    raise exception 'A reservation item is invalid, inactive, or exceeds available stock.' using errcode = 'check_violation';
  end if;

  insert into public.reservations (id, customer_name, note, expires_at, created_by)
  values (reservation_id, nullif(btrim(p_customer_name), ''), nullif(btrim(p_note), ''), p_expires_at, (select auth.uid()));

  insert into public.reservation_items (reservation_id, product_id, qty)
  select reservation_id, (item->>'product_id')::uuid, (item->>'qty')::integer
  from jsonb_array_elements(p_items) item;

  return reservation_id;
end;
$$;

revoke all on function public.create_reservation(jsonb, text, text, date) from public, anon;
grant execute on function public.create_reservation(jsonb, text, text, date) to authenticated;

create function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.current_user_role()) not in ('owner', 'manager', 'staff') then
    raise exception 'A shop role is required.' using errcode = 'insufficient_privilege';
  end if;
  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id
    and status = 'reserved'
    and (created_by = (select auth.uid()) or (select private.current_user_role()) in ('owner', 'manager'));
  if not found then raise exception 'Reservation not found or already closed.' using errcode = 'no_data_found'; end if;
end;
$$;

revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;

create function public.convert_reservation_to_sale(p_reservation_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.reservations%rowtype;
  sale_id uuid;
  items jsonb;
begin
  if (select private.current_user_role()) not in ('owner', 'manager', 'staff') then
    raise exception 'A shop role is required.' using errcode = 'insufficient_privilege';
  end if;

  select * into target from public.reservations where id = p_reservation_id for update;
  if not found or target.status <> 'reserved' then
    raise exception 'Reservation not found or already closed.' using errcode = 'no_data_found';
  end if;
  if target.created_by <> (select auth.uid()) and (select private.current_user_role()) not in ('owner', 'manager') then
    raise exception 'You can only convert your own reservations.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_agg(jsonb_build_object('product_id', ri.product_id, 'qty', ri.qty, 'unit_price', p.selling_price, 'discount', 0))
  into items
  from public.reservation_items ri
  join public.products p on p.id = ri.product_id
  where ri.reservation_id = p_reservation_id;

  sale_id := public.complete_sale_with_seller(items, 0, 'Cash', target.customer_name, 0, null, p_reservation_id);

  update public.reservations
  set status = 'converted', converted_sale_id = sale_id
  where id = p_reservation_id;

  return sale_id;
end;
$$;

revoke all on function public.convert_reservation_to_sale(uuid) from public, anon;
grant execute on function public.convert_reservation_to_sale(uuid) to authenticated;

-- Replace the wrapper so ordinary sales cannot consume units held by another
-- active reservation. Conversion excludes its own reservation from the hold.
drop function if exists public.complete_sale_with_seller(jsonb, numeric, text, text, numeric, text);

create function public.complete_sale_with_seller(
  p_items jsonb,
  p_order_discount numeric,
  p_payment_method text,
  p_customer_name text default null,
  p_amount_paid numeric default 0,
  p_seller_name text default null,
  p_reservation_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale_id uuid;
begin
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    join public.products p on p.id = (item->>'product_id')::uuid
    left join public.product_stock ps on ps.product_id = p.id
    where coalesce(ps.on_hand, 0) - coalesce((
      select sum(ri.qty)
      from public.reservation_items ri
      join public.reservations r on r.id = ri.reservation_id
      where ri.product_id = p.id
        and r.status = 'reserved'
        and (p_reservation_id is null or r.id <> p_reservation_id)
    ), 0) < (item->>'qty')::integer
  ) then
    raise exception 'A sale would consume stock held by an active reservation.' using errcode = 'check_violation';
  end if;

  sale_id := public.complete_sale(p_items, p_order_discount, p_payment_method, p_customer_name, p_amount_paid);
  update public.sales set seller_name = nullif(btrim(p_seller_name), '') where id = sale_id;
  return sale_id;
end;
$$;

revoke all on function public.complete_sale_with_seller(jsonb, numeric, text, text, numeric, text, uuid) from public, anon;
grant execute on function public.complete_sale_with_seller(jsonb, numeric, text, text, numeric, text, uuid) to authenticated;
