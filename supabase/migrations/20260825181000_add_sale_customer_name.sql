-- Customer name on a sale.
--
-- The seller is already recorded: sales.created_by defaults to auth.uid(), so
-- every sale rung up in this app already knows who made it. It was simply
-- never surfaced. Only the customer is genuinely new.
--
-- Nullable on purpose: plenty of counter sales are to someone who does not
-- give a name, and the 137 imported historical sales have none.

alter table public.sales
  add column if not exists customer_name text;

comment on column public.sales.customer_name is
  'Optional customer name captured at the counter. Null means not given.';

-- complete_sale gains a fourth argument. Adding a parameter creates a new
-- signature rather than replacing the old one, so the three-argument version
-- is dropped first to avoid two overloads that both match a three-arg call.
drop function if exists public.complete_sale(jsonb, numeric, text);

create function public.complete_sale(
  p_items jsonb,
  p_order_discount numeric,
  p_payment_method text,
  p_customer_name text default null
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
  product_record record;
begin
  if (select private.current_user_role()) not in ('owner', 'manager', 'staff') then
    raise exception 'A shop role is required.' using errcode = 'insufficient_privilege';
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

  insert into public.sales (id, sold_at, subtotal, discount, total, payment_method, status, created_by, is_historical, customer_name)
  values (sale_id, now(), subtotal_value, line_discount_value + p_order_discount, subtotal_value - line_discount_value - p_order_discount, btrim(p_payment_method), 'completed', (select auth.uid()), false, nullif(btrim(p_customer_name), ''));

  insert into public.sale_items (sale_id, product_id, description, qty, unit_price, discount, line_total)
  select sale_id, products.id, products.name, (item->>'qty')::integer, products.selling_price,
    (item->>'discount')::numeric,
    (item->>'qty')::integer * products.selling_price - (item->>'discount')::numeric
  from jsonb_array_elements(p_items) item
  join public.products on products.id = (item->>'product_id')::uuid;

  insert into public.stock_movements (product_id, delta, reason, reference_id, note, created_by)
  select (item->>'product_id')::uuid, -(item->>'qty')::integer, 'sale', sale_id, 'Counter POS sale', (select auth.uid())
  from jsonb_array_elements(p_items) item;

  return sale_id;
end;
$$;

revoke all on function public.complete_sale(jsonb, numeric, text, text) from public, anon;
grant execute on function public.complete_sale(jsonb, numeric, text, text) to authenticated;
