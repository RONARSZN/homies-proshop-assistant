-- Team riders and gear allocation.
--
-- Gear handed to a sponsored rider is not a sale: no revenue, no customer, but
-- it does leave the shop. Modelling it as a stock movement rather than a
-- separate allocations table means on-hand stays correct automatically, the
-- existing prevent_negative_stock trigger applies unchanged, and a rider's
-- history is a query over the ledger rather than a second source of truth.

create table public.team_riders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  nickname text,
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

-- Which rider a movement went to. Null for every other reason.
alter table public.stock_movements
  add column if not exists rider_id uuid references public.team_riders(id);

-- An allocation must name a rider, and nothing else may name one. This keeps
-- the ledger honest without a separate table to reconcile against.
alter table public.stock_movements
  add constraint stock_movements_rider_matches_reason
  check ((reason = 'allocation') = (rider_id is not null));

create index stock_movements_rider_idx on public.stock_movements (rider_id) where rider_id is not null;

-- stock_movements_insert_staff already lets any shop role insert. Allocation
-- is owner/manager only, so this restrictive policy ANDs with it rather than
-- widening access. Staff keep receipts, adjustments and write-offs.
create policy stock_movements_allocation_manager
on public.stock_movements as restrictive for insert to authenticated
with check (
  reason <> 'allocation'
  or (select private.current_user_role()) in ('owner', 'manager')
);
