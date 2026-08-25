-- Team riders and gear allocation.
--
-- Gear handed to a sponsored rider is not a sale: no revenue, no customer, but
-- it does leave the shop.
--
-- Allocations live in their own table rather than only in the stock ledger,
-- because imported history must NOT move stock. The pullout rows from the
-- workbook already happened, and current on-hand already reflects them —
-- writing them as movements would decrement the same units twice, the exact
-- double-count the sales import had to avoid.
--
-- So: rider_allocations is the record of what went to whom. A NEW allocation
-- additionally writes a stock movement and links it; a HISTORICAL one does
-- not. stock_movements stays the single authority on quantity.

create table public.team_riders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  nickname text,
  team text not null default 'Homies',
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create unique index team_riders_name_unique on public.team_riders (lower(btrim(full_name)));

alter table public.team_riders enable row level security;

create policy team_riders_read_authenticated
on public.team_riders for select to authenticated
using (true);

create policy team_riders_insert_manager
on public.team_riders for insert to authenticated
with check ((select private.current_user_role()) in ('owner', 'manager'));

create policy team_riders_update_manager
on public.team_riders for update to authenticated
using ((select private.current_user_role()) in ('owner', 'manager'))
with check ((select private.current_user_role()) in ('owner', 'manager'));

create policy team_riders_delete_owner
on public.team_riders for delete to authenticated
using ((select private.current_user_role()) = 'owner');

create table public.rider_allocations (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.team_riders(id),
  -- Nullable, like sale_items.product_id: some imported item codes match no
  -- current product. The raw code is kept either way.
  product_id uuid references public.products(id),
  item_code text not null check (btrim(item_code) <> ''),
  qty integer not null check (qty > 0),
  allocated_at date,
  note text,
  -- True for rows imported from the workbook. These never touched stock and
  -- must never be replayed into the ledger.
  is_historical boolean not null default false,
  movement_id uuid references public.stock_movements(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  -- A live allocation must carry its ledger entry; a historical one must not.
  constraint rider_allocations_movement_matches_history
    check (is_historical = (movement_id is null))
);

create index rider_allocations_rider_idx on public.rider_allocations (rider_id);
create index rider_allocations_product_idx on public.rider_allocations (product_id) where product_id is not null;

alter table public.rider_allocations enable row level security;

create policy rider_allocations_read_authenticated
on public.rider_allocations for select to authenticated
using (true);

create policy rider_allocations_insert_manager
on public.rider_allocations for insert to authenticated
with check ((select private.current_user_role()) in ('owner', 'manager'));

create policy rider_allocations_delete_owner
on public.rider_allocations for delete to authenticated
using ((select private.current_user_role()) = 'owner');

-- stock_movements_insert_staff already lets any shop role insert. Allocation
-- is owner/manager only, so this restrictive policy ANDs with it rather than
-- widening access. Staff keep receipts, adjustments and write-offs.
create policy stock_movements_allocation_manager
on public.stock_movements as restrictive for insert to authenticated
with check (
  reason <> 'allocation'
  or (select private.current_user_role()) in ('owner', 'manager')
);
