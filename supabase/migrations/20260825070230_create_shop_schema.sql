create type public.profile_role as enum ('owner', 'manager', 'staff');
create type public.stock_movement_reason as enum ('opening_balance', 'sale', 'return', 'receipt', 'adjustment', 'write_off');
create type public.sale_status as enum ('completed', 'voided');

create schema if not exists private;

do $$
begin
  if to_regclass('public.profiles') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'email'
    ) then
    if to_regclass('public.activity_logs') is not null then
      alter table public.activity_logs set schema private;
      alter table private.activity_logs rename to legacy_activity_logs;
    end if;

    alter table public.profiles set schema private;
    alter table private.profiles rename to legacy_profiles;
    revoke all on table private.legacy_profiles from anon, authenticated;

    if to_regclass('private.legacy_activity_logs') is not null then
      revoke all on table private.legacy_activity_logs from anon, authenticated;
    end if;
  end if;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  sort_order integer not null unique check (sort_order >= 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (btrim(sku) <> ''),
  name text not null check (btrim(name) <> ''),
  category_id uuid not null references public.categories(id),
  brand text,
  size text,
  colour text,
  unit_cost numeric null check (unit_cost is null or unit_cost > 0),
  selling_price numeric null check (selling_price is null or selling_price > 0),
  supplier text,
  received_at date null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  role public.profile_role not null
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sold_at timestamptz not null,
  subtotal numeric not null check (subtotal >= 0),
  discount numeric not null default 0 check (discount >= 0 and discount <= subtotal),
  total numeric not null check (total >= 0 and total = subtotal - discount),
  payment_method text,
  status public.sale_status not null default 'completed',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  is_historical boolean not null default false
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid null references public.products(id),
  description text not null check (btrim(description) <> ''),
  qty integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  discount numeric not null default 0 check (discount >= 0 and discount <= qty * unit_price),
  line_total numeric not null check (line_total >= 0 and line_total = qty * unit_price - discount)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  delta integer not null check (delta <> 0),
  reason public.stock_movement_reason not null,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products(category_id);
create index sales_sold_at_idx on public.sales(sold_at desc);
create index sale_items_sale_id_idx on public.sale_items(sale_id);
create index sale_items_product_id_idx on public.sale_items(product_id);
create index stock_movements_product_id_created_at_idx on public.stock_movements(product_id, created_at desc);
create index stock_movements_reference_id_idx on public.stock_movements(reference_id) where reference_id is not null;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create function private.current_user_role()
returns public.profile_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.current_user_role() from public;
grant execute on function private.current_user_role() to authenticated;
revoke all on function private.set_updated_at() from public;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;

create policy categories_read_authenticated
on public.categories for select to authenticated
using (true);

create policy categories_write_owner
on public.categories for all to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');

create policy products_read_authenticated
on public.products for select to authenticated
using (true);

create policy products_insert_manager
on public.products for insert to authenticated
with check ((select private.current_user_role()) in ('owner', 'manager'));

create policy products_update_manager
on public.products for update to authenticated
using ((select private.current_user_role()) in ('owner', 'manager'))
with check ((select private.current_user_role()) in ('owner', 'manager'));

create policy products_delete_owner
on public.products for delete to authenticated
using ((select private.current_user_role()) = 'owner');

create policy profiles_read_authenticated
on public.profiles for select to authenticated
using (true);

create policy profiles_write_owner
on public.profiles for all to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');

create policy sales_read_authenticated
on public.sales for select to authenticated
using (true);

create policy sales_insert_staff
on public.sales for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
);

create policy sales_update_owner
on public.sales for update to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');

create policy sales_delete_owner
on public.sales for delete to authenticated
using ((select private.current_user_role()) = 'owner');

create policy sale_items_read_authenticated
on public.sale_items for select to authenticated
using (true);

create policy sale_items_insert_staff
on public.sale_items for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.created_by = (select auth.uid())
  )
);

create policy sale_items_write_owner
on public.sale_items for all to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');

create policy stock_movements_read_authenticated
on public.stock_movements for select to authenticated
using (true);

create policy stock_movements_insert_staff
on public.stock_movements for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
);

revoke all on table public.categories, public.products, public.profiles, public.sales, public.sale_items, public.stock_movements from anon;
grant select on table public.categories, public.products, public.profiles, public.sales, public.sale_items, public.stock_movements to authenticated;
grant insert, update, delete on table public.categories, public.products, public.profiles, public.sales, public.sale_items to authenticated;
grant insert on table public.stock_movements to authenticated;
revoke update, delete on table public.stock_movements from authenticated;

create view public.product_stock
with (security_invoker = true)
as
select
  products.id as product_id,
  coalesce(sum(stock_movements.delta), 0)::integer as on_hand
from public.products
left join public.stock_movements on stock_movements.product_id = products.id
group by products.id;

revoke all on table public.product_stock from anon;
grant select on table public.product_stock to authenticated;

insert into public.categories (name, sort_order)
values
  ('BOARDS', 10),
  ('BINDINGS', 20),
  ('VESTS', 30),
  ('LUGGAGE', 40),
  ('WETSUITS', 50),
  ('OUTWEAR', 60),
  ('HELMETS', 70);
