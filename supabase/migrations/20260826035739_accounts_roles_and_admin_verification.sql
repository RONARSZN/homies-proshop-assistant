create type public.app_role as enum ('admin', 'staff');
create type public.profile_status as enum ('pending', 'active', 'rejected');

alter table public.profiles
  add column role_new public.app_role,
  add column status public.profile_status not null default 'pending',
  add column email text,
  add column phone text,
  add column avatar_path text,
  add column requested_at timestamptz not null default now(),
  add column verified_by uuid references auth.users(id) on delete set null,
  add column verified_at timestamptz;

update public.profiles p
set
  role_new = case p.role::text
    when 'owner' then 'admin'::public.app_role
    else 'staff'::public.app_role
  end,
  status = 'active',
  email = u.email,
  requested_at = u.created_at,
  verified_at = now()
from auth.users u
where u.id = p.id;

alter table public.profiles alter column email set not null;

create index profiles_status_requested_at_idx
  on public.profiles(status, requested_at);
create index profiles_verified_by_idx
  on public.profiles(verified_by)
  where verified_by is not null;

create function private.current_user_role_v2()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role_new
  from public.profiles
  where id = (select auth.uid())
    and status = 'active'
$$;

create function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
  )
$$;

revoke all on function private.current_user_role_v2() from public, anon;
revoke all on function private.is_active() from public, anon;
grant execute on function private.current_user_role_v2() to authenticated;
grant execute on function private.is_active() to authenticated;

create or replace function public.create_product(
  p_sku text,
  p_name text,
  p_category_id uuid,
  p_brand text default null,
  p_size text default null,
  p_colour text default null,
  p_unit_cost numeric default null,
  p_selling_price numeric default null,
  p_supplier text default null,
  p_received_at date default null,
  p_opening_quantity integer default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_id uuid;
begin
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may add products.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_sku), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'SKU and product name are required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Select a valid category.' using errcode = 'foreign_key_violation';
  end if;
  if p_opening_quantity < 0 then
    raise exception 'Opening quantity cannot be negative.' using errcode = 'check_violation';
  end if;

  insert into public.products (
    sku, name, category_id, brand, size, colour, unit_cost,
    selling_price, supplier, received_at
  )
  values (
    btrim(p_sku), btrim(p_name), p_category_id, nullif(btrim(p_brand), ''),
    nullif(btrim(p_size), ''), nullif(btrim(p_colour), ''), p_unit_cost,
    p_selling_price, nullif(btrim(p_supplier), ''), p_received_at
  )
  returning id into product_id;

  if p_opening_quantity > 0 then
    insert into public.stock_movements (product_id, delta, reason, note, created_by)
    values (product_id, p_opening_quantity, 'receipt', 'Initial stock entered when product was created', (select auth.uid()));
  end if;

  return product_id;
end;
$$;

create or replace function public.complete_sale(
  p_items jsonb,
  p_order_discount numeric,
  p_payment_method text,
  p_customer_name text default null,
  p_amount_paid numeric default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale_id uuid := gen_random_uuid();
  subtotal_value numeric;
  line_discount_value numeric;
  total_value numeric;
  product_record record;
begin
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may complete sales.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one sale item is required.' using errcode = 'check_violation';
  end if;
  if p_order_discount is null or p_order_discount < 0 then
    raise exception 'Order discount cannot be negative.' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_payment_method), '') is null then
    raise exception 'Payment method is required.' using errcode = 'check_violation';
  end if;
  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative.' using errcode = 'check_violation';
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
      or products.selling_price is null
      or (item->>'qty')::integer <= 0
      or (item->>'discount')::numeric < 0
      or (item->>'discount')::numeric > (item->>'qty')::integer * products.selling_price
      or coalesce(product_stock.on_hand, 0) < (item->>'qty')::integer
  ) then
    raise exception 'A sale item is invalid, inactive, unpriced, or out of stock.' using errcode = 'check_violation';
  end if;

  select
    sum((item->>'qty')::integer * products.selling_price),
    sum((item->>'discount')::numeric)
  into subtotal_value, line_discount_value
  from jsonb_array_elements(p_items) item
  join public.products on products.id = (item->>'product_id')::uuid;

  if p_order_discount > subtotal_value - line_discount_value then
    raise exception 'Order discount exceeds the sale subtotal.' using errcode = 'check_violation';
  end if;
  total_value := subtotal_value - line_discount_value - p_order_discount;
  if p_amount_paid > total_value then
    raise exception 'Amount paid cannot exceed the sale total.' using errcode = 'check_violation';
  end if;

  insert into public.sales (
    id, sold_at, subtotal, discount, total, payment_method,
    status, created_by, is_historical, customer_name
  )
  values (
    sale_id, now(), subtotal_value, line_discount_value + p_order_discount,
    total_value, btrim(p_payment_method), 'completed', (select auth.uid()),
    false, nullif(btrim(p_customer_name), '')
  );

  insert into public.sale_items (
    sale_id, product_id, description, qty, unit_price, discount, line_total
  )
  select
    sale_id, products.id, products.name, (item->>'qty')::integer,
    products.selling_price, (item->>'discount')::numeric,
    (item->>'qty')::integer * products.selling_price - (item->>'discount')::numeric
  from jsonb_array_elements(p_items) item
  join public.products on products.id = (item->>'product_id')::uuid;

  insert into public.stock_movements (product_id, delta, reason, reference_id, note, created_by)
  select
    (item->>'product_id')::uuid, -(item->>'qty')::integer, 'sale', sale_id,
    'Counter POS sale', (select auth.uid())
  from jsonb_array_elements(p_items) item;

  if p_amount_paid > 0 then
    insert into public.sale_payments (sale_id, amount, payment_method, created_by)
    values (sale_id, p_amount_paid, btrim(p_payment_method), (select auth.uid()));
  end if;

  return sale_id;
end;
$$;

create or replace function public.record_sale_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_sale public.sales%rowtype;
  received numeric;
  payment_id uuid;
begin
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may record sale payments.' using errcode = 'insufficient_privilege';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_payment_method), '') is null then
    raise exception 'Payment method is required.' using errcode = 'check_violation';
  end if;

  select * into target_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found.' using errcode = 'no_data_found'; end if;
  if target_sale.is_historical then raise exception 'Historical sales cannot receive new payments.' using errcode = 'check_violation'; end if;
  if target_sale.status <> 'completed' then raise exception 'Only completed sales can receive payments.' using errcode = 'check_violation'; end if;
  if target_sale.total is null then raise exception 'This sale has no captured total.' using errcode = 'check_violation'; end if;

  select coalesce(sum(amount), 0) into received from public.sale_payments where sale_id = p_sale_id;
  if received + p_amount > target_sale.total then
    raise exception 'Payment would exceed the outstanding balance.' using errcode = 'check_violation';
  end if;

  insert into public.sale_payments (sale_id, amount, payment_method, note, created_by)
  values (p_sale_id, p_amount, btrim(p_payment_method), nullif(btrim(p_note), ''), (select auth.uid()))
  returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_sale public.sales%rowtype;
  product_record record;
begin
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may void a sale.' using errcode = 'insufficient_privilege';
  end if;
  select * into target_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found.' using errcode = 'no_data_found'; end if;
  if target_sale.is_historical then raise exception 'Historical sales cannot be voided.' using errcode = 'check_violation'; end if;
  if target_sale.status = 'voided' then raise exception 'Sale is already voided.' using errcode = 'check_violation'; end if;
  for product_record in
    select distinct product_id
    from public.sale_items
    where sale_id = p_sale_id and product_id is not null
    order by product_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(product_record.product_id::text, 0));
  end loop;
  insert into public.stock_movements(product_id, delta, reason, reference_id, note, created_by)
  select product_id, qty, 'return', p_sale_id, 'Compensating movement for voided sale', (select auth.uid())
  from public.sale_items
  where sale_id = p_sale_id and product_id is not null;
  update public.sales set status = 'voided' where id = p_sale_id;
end;
$$;

create or replace function public.create_reservation(
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
  if (select private.current_user_role_v2()) not in ('admin', 'staff') then
    raise exception 'An active shop role is required.' using errcode = 'insufficient_privilege';
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

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.current_user_role_v2()) not in ('admin', 'staff') then
    raise exception 'An active shop role is required.' using errcode = 'insufficient_privilege';
  end if;
  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id
    and status = 'reserved'
    and (
      created_by = (select auth.uid())
      or (select private.current_user_role_v2()) = 'admin'
    );
  if not found then
    raise exception 'Reservation not found or already closed.' using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function public.convert_reservation_to_sale(p_reservation_id uuid)
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
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may convert reservations to sales.' using errcode = 'insufficient_privilege';
  end if;

  select * into target from public.reservations where id = p_reservation_id for update;
  if not found or target.status <> 'reserved' then
    raise exception 'Reservation not found or already closed.' using errcode = 'no_data_found';
  end if;

  select jsonb_agg(jsonb_build_object(
    'product_id', ri.product_id,
    'qty', ri.qty,
    'unit_price', p.selling_price,
    'discount', 0
  ))
  into items
  from public.reservation_items ri
  join public.products p on p.id = ri.product_id
  where ri.reservation_id = p_reservation_id;

  sale_id := public.complete_sale_with_seller(
    items, 0, 'Cash', target.customer_name, 0, null, p_reservation_id
  );

  update public.reservations
  set status = 'converted', converted_sale_id = sale_id
  where id = p_reservation_id;

  return sale_id;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where (
      schemaname = 'public'
      and tablename in (
        'categories', 'products', 'profiles', 'sales', 'sale_items',
        'sale_payments', 'stock_movements', 'team_riders',
        'rider_allocations', 'reservations', 'reservation_items'
      )
    ) or (
      schemaname = 'storage'
      and tablename = 'objects'
      and (policyname like 'product_photos_%' or policyname like 'avatars_%')
    )
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end;
$$;

create policy categories_read_active
on public.categories for select to authenticated
using ((select private.is_active()));
create policy categories_insert_admin
on public.categories for insert to authenticated
with check ((select private.current_user_role_v2()) = 'admin');
create policy categories_update_admin
on public.categories for update to authenticated
using ((select private.current_user_role_v2()) = 'admin')
with check ((select private.current_user_role_v2()) = 'admin');
create policy categories_delete_admin
on public.categories for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy products_read_active
on public.products for select to authenticated
using ((select private.is_active()));
create policy products_insert_admin
on public.products for insert to authenticated
with check ((select private.current_user_role_v2()) = 'admin');
create policy products_update_admin
on public.products for update to authenticated
using ((select private.current_user_role_v2()) = 'admin')
with check ((select private.current_user_role_v2()) = 'admin');
create policy products_delete_admin
on public.products for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy profiles_read_self_or_admin
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_role_v2()) = 'admin'
);
create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_role_v2()) = 'admin'
)
with check (
  id = (select auth.uid())
  or (select private.current_user_role_v2()) = 'admin'
);

create policy sales_read_admin
on public.sales for select to authenticated
using ((select private.current_user_role_v2()) = 'admin');
create policy sales_insert_admin
on public.sales for insert to authenticated
with check (
  (select private.current_user_role_v2()) = 'admin'
  and created_by = (select auth.uid())
);
create policy sales_update_admin
on public.sales for update to authenticated
using ((select private.current_user_role_v2()) = 'admin')
with check ((select private.current_user_role_v2()) = 'admin');
create policy sales_delete_admin
on public.sales for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy sale_items_read_admin
on public.sale_items for select to authenticated
using ((select private.current_user_role_v2()) = 'admin');
create policy sale_items_insert_admin
on public.sale_items for insert to authenticated
with check (
  (select private.current_user_role_v2()) = 'admin'
  and exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
      and sales.created_by = (select auth.uid())
  )
);
create policy sale_items_update_admin
on public.sale_items for update to authenticated
using ((select private.current_user_role_v2()) = 'admin')
with check ((select private.current_user_role_v2()) = 'admin');
create policy sale_items_delete_admin
on public.sale_items for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy sale_payments_read_admin
on public.sale_payments for select to authenticated
using ((select private.current_user_role_v2()) = 'admin');
create policy sale_payments_insert_admin
on public.sale_payments for insert to authenticated
with check (
  (select private.current_user_role_v2()) = 'admin'
  and created_by = (select auth.uid())
);

create policy stock_movements_read_active
on public.stock_movements for select to authenticated
using ((select private.is_active()));
create policy stock_movements_insert_admin
on public.stock_movements for insert to authenticated
with check (
  (select private.current_user_role_v2()) = 'admin'
  and created_by = (select auth.uid())
);

create policy team_riders_read_admin
on public.team_riders for select to authenticated
using ((select private.current_user_role_v2()) = 'admin');
create policy team_riders_insert_admin
on public.team_riders for insert to authenticated
with check ((select private.current_user_role_v2()) = 'admin');
create policy team_riders_update_admin
on public.team_riders for update to authenticated
using ((select private.current_user_role_v2()) = 'admin')
with check ((select private.current_user_role_v2()) = 'admin');
create policy team_riders_delete_admin
on public.team_riders for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy rider_allocations_read_admin
on public.rider_allocations for select to authenticated
using ((select private.current_user_role_v2()) = 'admin');
create policy rider_allocations_insert_admin
on public.rider_allocations for insert to authenticated
with check ((select private.current_user_role_v2()) = 'admin');
create policy rider_allocations_delete_admin
on public.rider_allocations for delete to authenticated
using ((select private.current_user_role_v2()) = 'admin');

create policy reservations_read_active
on public.reservations for select to authenticated
using ((select private.is_active()));
create policy reservations_insert_active
on public.reservations for insert to authenticated
with check (
  (select private.current_user_role_v2()) in ('admin', 'staff')
  and created_by = (select auth.uid())
);
create policy reservations_update_owner_or_admin
on public.reservations for update to authenticated
using (
  (select private.current_user_role_v2()) in ('admin', 'staff')
  and status = 'reserved'
  and (
    created_by = (select auth.uid())
    or (select private.current_user_role_v2()) = 'admin'
  )
)
with check (
  (select private.current_user_role_v2()) in ('admin', 'staff')
  and status in ('reserved', 'converted', 'cancelled')
  and (
    created_by = (select auth.uid())
    or (select private.current_user_role_v2()) = 'admin'
  )
);

create policy reservation_items_read_active
on public.reservation_items for select to authenticated
using ((select private.is_active()));
create policy reservation_items_insert_owner_or_admin
on public.reservation_items for insert to authenticated
with check (
  (select private.current_user_role_v2()) in ('admin', 'staff')
  and exists (
    select 1 from public.reservations
    where reservations.id = reservation_items.reservation_id
      and reservations.status = 'reserved'
      and (
        reservations.created_by = (select auth.uid())
        or (select private.current_user_role_v2()) = 'admin'
      )
  )
);

create policy product_photos_read_active
on storage.objects for select to authenticated
using (
  bucket_id = 'product-photos'
  and (select private.is_active())
);
create policy product_photos_insert_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-photos'
  and (select private.current_user_role_v2()) = 'admin'
);
create policy product_photos_update_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'product-photos'
  and (select private.current_user_role_v2()) = 'admin'
)
with check (
  bucket_id = 'product-photos'
  and (select private.current_user_role_v2()) = 'admin'
);
create policy product_photos_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-photos'
  and (select private.current_user_role_v2()) = 'admin'
);

drop function private.current_user_role();
alter table public.profiles drop column role;
alter table public.profiles rename column role_new to role;
drop type public.profile_role;

alter table public.profiles
  add constraint profiles_status_role_check check (
    (status = 'active' and role is not null)
    or (status in ('pending', 'rejected') and role is null)
  );

create function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_role_v2()
$$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

create function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_role public.app_role := (select private.current_user_role_v2());
  access_changed boolean := new.role is distinct from old.role or new.status is distinct from old.status;
begin
  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.requested_at is distinct from old.requested_at then
    raise exception 'Account identity fields cannot be changed here.' using errcode = 'insufficient_privilege';
  end if;

  if access_changed then
    if caller_role is distinct from 'admin' then
      raise exception 'Only an admin may change account access.' using errcode = 'insufficient_privilege';
    end if;
    if old.id = caller then
      raise exception 'Admins cannot change their own role or status.' using errcode = 'insufficient_privilege';
    end if;
    if old.status = 'active' and old.role = 'admin'
      and (new.status is distinct from 'active' or new.role is distinct from 'admin')
      and (
        select count(*)
        from public.profiles
        where status = 'active' and role = 'admin'
      ) <= 1 then
      raise exception 'The last active admin cannot be demoted or rejected.' using errcode = 'check_violation';
    end if;
    new.verified_by := caller;
    new.verified_at := now();
  elsif new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at then
    raise exception 'Verification audit fields are managed automatically.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_changes() from public, anon, authenticated;

create trigger profiles_guard_changes
before update on public.profiles
for each row execute function private.guard_profile_changes();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, role, status, email, requested_at
  )
  values (
    new.id,
    btrim(coalesce(new.raw_user_meta_data->>'full_name', '')),
    null,
    'pending',
    new.email,
    new.created_at
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger auth_user_create_profile
after insert on auth.users
for each row execute function private.handle_new_user();

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'avatars', 'avatars', false, 300000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read_self_or_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.current_user_role_v2()) = 'admin'
  )
);
create policy avatars_insert_self
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy avatars_update_self
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy avatars_delete_self
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

revoke all on table
  public.categories,
  public.products,
  public.profiles,
  public.sales,
  public.sale_items,
  public.sale_payments,
  public.stock_movements,
  public.team_riders,
  public.rider_allocations,
  public.reservations,
  public.reservation_items,
  public.product_stock
from anon, authenticated;

grant select on table
  public.categories,
  public.products,
  public.profiles,
  public.sales,
  public.sale_items,
  public.sale_payments,
  public.stock_movements,
  public.team_riders,
  public.rider_allocations,
  public.reservations,
  public.reservation_items,
  public.product_stock
to authenticated;

grant insert, update, delete on table
  public.categories,
  public.products,
  public.sales,
  public.sale_items,
  public.team_riders,
  public.rider_allocations
to authenticated;

grant update on table public.profiles to authenticated;
grant insert on table public.sale_payments to authenticated;
grant insert on table public.stock_movements to authenticated;
grant insert, update on table public.reservations to authenticated;
grant insert on table public.reservation_items to authenticated;

comment on column public.profiles.role is 'Assigned by an admin when a pending account is approved.';
comment on column public.profiles.status is 'Pending accounts can only access their own profile and avatar.';
comment on column public.profiles.avatar_path is 'Private avatars bucket object path; never a public URL.';
