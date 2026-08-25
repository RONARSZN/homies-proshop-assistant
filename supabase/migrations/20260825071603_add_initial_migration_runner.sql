alter table public.stock_movements drop constraint stock_movements_delta_check;
alter table public.stock_movements add constraint stock_movements_delta_check
check (delta <> 0 or reason = 'opening_balance');

alter table public.sales alter column subtotal drop not null;
alter table public.sales alter column discount drop not null;
alter table public.sales alter column discount drop default;
alter table public.sales alter column total drop not null;
alter table public.sale_items alter column unit_price drop not null;
alter table public.sale_items alter column discount drop not null;
alter table public.sale_items alter column discount drop default;
alter table public.sale_items alter column line_total drop not null;

create function public.run_initial_migration(p_products jsonb, p_sales jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_products integer;
  inserted_sales integer;
  inserted_sale_items integer;
  inserted_movements integer;
begin
  if exists (select 1 from public.products)
    or exists (select 1 from public.sales)
    or exists (select 1 from public.sale_items)
    or exists (select 1 from public.stock_movements) then
    raise exception 'Initial migration refused: target tables are not empty.';
  end if;

  insert into public.products (
    id, sku, name, category_id, brand, size, colour, unit_cost,
    selling_price, supplier, received_at, is_active
  )
  select
    (row->>'id')::uuid,
    row->>'sku',
    row->>'name',
    categories.id,
    nullif(row->>'brand', ''),
    nullif(row->>'size', ''),
    nullif(row->>'colour', ''),
    (row->>'unit_cost')::numeric,
    (row->>'selling_price')::numeric,
    nullif(row->>'supplier', ''),
    (row->>'received_at')::date,
    true
  from jsonb_array_elements(p_products) row
  join public.categories on categories.name = row->>'category';
  get diagnostics inserted_products = row_count;

  if inserted_products <> jsonb_array_length(p_products) then
    raise exception 'Product insert count mismatch: expected %, inserted %', jsonb_array_length(p_products), inserted_products;
  end if;

  insert into public.stock_movements (id, product_id, delta, reason, note)
  select
    (row->>'movement_id')::uuid,
    (row->>'id')::uuid,
    (row->>'on_hand')::integer,
    'opening_balance',
    'Google Sheet cutover opening balance'
  from jsonb_array_elements(p_products) row;
  get diagnostics inserted_movements = row_count;

  insert into public.sales (
    id, sold_at, subtotal, discount, total, payment_method,
    status, created_by, is_historical
  )
  select
    (row->>'id')::uuid,
    (row->>'sold_at')::timestamptz,
    (row->>'total')::numeric,
    case when row->>'total' is null then null else 0 end,
    (row->>'total')::numeric,
    null,
    'completed',
    null,
    true
  from jsonb_array_elements(p_sales) row;
  get diagnostics inserted_sales = row_count;

  insert into public.sale_items (
    id, sale_id, product_id, description, qty, unit_price, discount, line_total
  )
  select
    (row->>'item_id')::uuid,
    (row->>'id')::uuid,
    (row->>'product_id')::uuid,
    row->>'description',
    (row->>'qty')::integer,
    case when row->>'total' is null then null else (row->>'total')::numeric / (row->>'qty')::integer end,
    case when row->>'total' is null then null else 0 end,
    (row->>'total')::numeric
  from jsonb_array_elements(p_sales) row;
  get diagnostics inserted_sale_items = row_count;

  return jsonb_build_object(
    'products', inserted_products,
    'sales', inserted_sales,
    'sale_items', inserted_sale_items,
    'stock_movements', inserted_movements
  );
end;
$$;

revoke all on function public.run_initial_migration(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.run_initial_migration(jsonb, jsonb) to service_role;
