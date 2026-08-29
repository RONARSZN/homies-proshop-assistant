-- Make a rider allocation atomic.
--
-- The client used to do this in three separate round trips: read the SKU,
-- insert the stock movement, then insert the allocation row. If the last one
-- failed, the ledger had already been debited and nothing recorded where the
-- gear went — stock gone, no rider attached to it. Every other write of this
-- weight (sales, payments, reservations) already goes through an RPC; this is
-- the one that did not.
--
-- Both inserts now happen in one transaction, so either the rider has the gear
-- and the ledger says so, or neither row exists.
--
-- Note on scope: this deliberately does NOT check reserved stock the way
-- complete_sale_with_seller does. Allocating a unit held by an active
-- reservation is still permitted, exactly as before. Changing that is a
-- business rule decision, not part of making the write atomic.

create function public.allocate_to_rider(
  p_rider_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allocation_id uuid;
  ledger_id uuid;
  product_sku text;
  clean_note text := nullif(btrim(p_note), '');
begin
  if (select private.current_user_role_v2()) <> 'admin' then
    raise exception 'Only an admin may allocate gear to a rider.' using errcode = 'insufficient_privilege';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Allocation quantity must be greater than zero.' using errcode = 'check_violation';
  end if;

  select sku into product_sku
  from public.products
  where id = p_product_id and is_active;
  if not found then
    raise exception 'Select a valid, active product.' using errcode = 'foreign_key_violation';
  end if;

  if not exists (select 1 from public.team_riders where id = p_rider_id and is_active) then
    raise exception 'Select an active team rider.' using errcode = 'foreign_key_violation';
  end if;

  -- The ledger entry first: prevent_negative_stock takes the per-product
  -- advisory lock here, so an over-allocation is rejected before any
  -- allocation row exists to roll back.
  insert into public.stock_movements (product_id, delta, reason, note, created_by)
  values (p_product_id, -p_qty, 'allocation', clean_note, (select auth.uid()))
  returning id into ledger_id;

  insert into public.rider_allocations (
    rider_id, product_id, item_code, qty, allocated_at,
    note, is_historical, movement_id, created_by
  )
  values (
    p_rider_id, p_product_id, product_sku, p_qty, current_date,
    clean_note, false, ledger_id, (select auth.uid())
  )
  returning id into allocation_id;

  return allocation_id;
end;
$$;

revoke all on function public.allocate_to_rider(uuid, uuid, integer, text) from public, anon;
grant execute on function public.allocate_to_rider(uuid, uuid, integer, text) to authenticated;
