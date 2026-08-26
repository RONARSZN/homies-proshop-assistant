-- Partial payments are append-only records separate from the sale total.
-- The sale total is the agreed price; payment rows record cash received.

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric not null check (amount > 0),
  payment_method text not null check (btrim(payment_method) <> ''),
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  note text
);

create index sale_payments_sale_id_idx on public.sale_payments(sale_id);

alter table public.sale_payments enable row level security;

create policy sale_payments_read_authenticated
on public.sale_payments for select to authenticated
using (true);

create policy sale_payments_insert_staff
on public.sale_payments for insert to authenticated
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
);

revoke all on table public.sale_payments from anon;
grant select, insert on table public.sale_payments to authenticated;

-- Existing completed records only have a total, so seed one recorded payment
-- for each known total. Future payments use the append-only process below.
insert into public.sale_payments (sale_id, amount, payment_method, paid_at, created_by, note)
select id, total, coalesce(nullif(btrim(payment_method), ''), 'Unspecified'), sold_at, created_by, 'Backfilled from existing sale record'
from public.sales
where status = 'completed'
  and total is not null
  and not exists (select 1 from public.sale_payments where sale_id = public.sales.id);

drop function if exists public.complete_sale(jsonb, numeric, text, text);

create function public.complete_sale(
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

  insert into public.sales (id, sold_at, subtotal, discount, total, payment_method, status, created_by, is_historical, customer_name)
  values (sale_id, now(), subtotal_value, line_discount_value + p_order_discount, total_value, btrim(p_payment_method), 'completed', (select auth.uid()), false, nullif(btrim(p_customer_name), ''));

  insert into public.sale_items (sale_id, product_id, description, qty, unit_price, discount, line_total)
  select sale_id, products.id, products.name, (item->>'qty')::integer, products.selling_price,
    (item->>'discount')::numeric,
    (item->>'qty')::integer * products.selling_price - (item->>'discount')::numeric
  from jsonb_array_elements(p_items) item
  join public.products on products.id = (item->>'product_id')::uuid;

  insert into public.stock_movements (product_id, delta, reason, reference_id, note, created_by)
  select (item->>'product_id')::uuid, -(item->>'qty')::integer, 'sale', sale_id, 'Counter POS sale', (select auth.uid())
  from jsonb_array_elements(p_items) item;

  if p_amount_paid > 0 then
    insert into public.sale_payments (sale_id, amount, payment_method, created_by)
    values (sale_id, p_amount_paid, btrim(p_payment_method), (select auth.uid()));
  end if;

  return sale_id;
end;
$$;

revoke all on function public.complete_sale(jsonb, numeric, text, text, numeric) from public, anon;
grant execute on function public.complete_sale(jsonb, numeric, text, text, numeric) to authenticated;

create function public.record_sale_payment(
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
  if (select private.current_user_role()) not in ('owner', 'manager', 'staff') then
    raise exception 'A shop role is required.' using errcode = 'insufficient_privilege';
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

revoke all on function public.record_sale_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_sale_payment(uuid, numeric, text, text) to authenticated;
